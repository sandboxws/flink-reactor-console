# Changelog-propagation invariants

Spec ID prefix: `CLM` | Status: active | Canonical for: how
append-only / retract semantics are derived at sources and propagated to
sinks.

## Scope

Governs changelog-mode **derivation** (component factories in
`src/components/sources.ts`) and **propagation** (two implementations:
the validation walk in `src/core/changelog-propagation.ts` and the
codegen walk in `src/codegen/sql/sql-sink-metadata.ts`), plus the sink
DDL consequences in `src/codegen/sql/sql-ddl-sink.ts`. Does not govern
Flink's own runtime changelog handling.

## Invariants

### CLM-1: KafkaSource mode is format-derived at element creation
`KafkaSource` MUST derive its mode via `inferChangelogMode(format)`:
retract iff format ∈ {`debezium-json`, `debezium-avro`,
`debezium-protobuf`, `canal-json`, `maxwell-json`} (`CDC_FORMATS`), else
append-only (the default format is `json`). The result is stored on
`props.changelogMode` at factory time — downstream code reads the prop,
never re-derives from format.

### CLM-2: Per-source fixed modes
`PostgresCdcPipelineSource` MUST always be retract. `FlussSource` MUST be
retract iff its `primaryKey` prop is a non-empty array, else append-only.

### CLM-3: The two propagation walks MUST agree
There are two independent implementations of propagation:

| Walk | File | Traversal |
|---|---|---|
| validation | `src/core/changelog-propagation.ts` | DAG, topological order |
| codegen | `src/codegen/sql/sql-sink-metadata.ts` | tree + sibling-chain |

For any topology both can express, they MUST derive the same
sink-effective mode. This is enforced only socially today — there is no
agreement test. Known divergences are tracked in
`bugs/031-changelog-walk-divergences.md` (see CLM-8).

### CLM-4: Operator propagation rules
The validation walk MUST apply:

| Node | Output mode |
|---|---|
| Source | own `props.changelogMode` (default append-only) |
| Pipeline / Window (kind) | passthrough first input |
| Filter / Map / FlatMap / TopN | passthrough |
| Aggregate, unbounded | retract |
| Aggregate, parent is Window | append-only |
| Deduplicate | append-only (warning when input is retract) |
| Union | retract iff any input retract |
| Join (kind) | retract iff any input retract |
| Sink / anything else | passthrough |

The codegen walk's transform-chain rule: an `Aggregate` with no `Window`
in the chain forces retract; `SessionWindow` forces retract; everything
else preserves upstream mode. Anti/semi joins force retract regardless of
input modes (sibling-walk only — see CLM-8).

### CLM-5: PK-bearing KafkaSource is upsert-kafka-shaped
A `KafkaSource` whose schema declares a primary key MUST be treated as
retract by the codegen walk even when its format is not a CDC format
(`resolveSourceChangelogMode`): it will be emitted with the
`upsert-kafka` connector, which carries upsert semantics. Root cause of
BUG-010.

### CLM-6: Retract + PK KafkaSink emits upsert-kafka
A `KafkaSink` whose resolved metadata is retract with a derivable primary
key MUST be emitted as `'connector' = 'upsert-kafka'` with split
key/value formats (an insert-only value format — changelog formats are
stripped). Retract **without** a derivable PK is the BUG-011 error
surface: there is nothing valid to emit.

### CLM-7: Append-only sinks reject retract input
Sinks outside {`JdbcSink` with `upsertMode: true`, `PaimonSink`,
`IcebergSink`} MUST produce a `severity: "error"`,
`category: "changelog"` diagnostic when any input mode is not
append-only.

### CLM-8: Known divergences between the walks (to reconcile)
Documented divergences, filed as `bugs/031-changelog-walk-divergences.md`:

1. **SessionWindow** — codegen forces retract (sessions can merge on late
   events); validation treats `Window` kind as passthrough.
2. **Anti/semi joins** — codegen forces retract regardless of inputs (the
   result set changes when the right side changes); validation only
   considers input modes.

In both cases the codegen walk encodes the correct Flink semantics; the
validation walk under-reports. Consequence today: validation can pass a
topology whose generated DDL is upsert-shaped (or whose sink should have
been rejected under CLM-7). The fix belongs in
`src/core/changelog-propagation.ts`; when it lands, fold the rules into
the CLM-4 table and tombstone this invariant.

## Rationale

Changelog mode decides connector choice (`kafka` vs `upsert-kafka`),
PRIMARY KEY emission, and which sinks are legal — wrong propagation
produces DDL that Flink rejects at submit time (BUG-010/011) or, worse,
accepts with wrong semantics. The mode must be derived once at factory
time (CLM-1/2) because the LSP and console read `props.changelogMode`
without access to format-derivation logic.

## Enforced by

| Invariant | Test |
|---|---|
| CLM-1, CLM-2 | `src/components/__tests__/sources.test.ts`, `src/components/__tests__/cdc-changelog.test.ts` |
| CLM-4 | `src/core/__tests__/changelog-propagation.test.ts` ("computeChangelogModes", "Join changelog mode") |
| CLM-5, CLM-6 | `src/codegen/__tests__/sql-generator.test.ts` (upsert-kafka suites), example snapshots |
| CLM-7 | `src/core/__tests__/changelog-propagation.test.ts` ("validateChangelogModes") |
| CLM-3 | **gap** — no agreement test between the walks (follow-up) |

## Violations seen historically

- `bugs/010-kafka-source-pk-requires-upsert-connector.md` — source side
  ignored the PK-implies-upsert rule (CLM-5).
- `bugs/011-anti-join-retract-no-pk-for-kafka-sink.md` — retract without
  derivable PK reached the Kafka sink emitter (CLM-6).
- `bugs/029-multiple-rowtime-cols-in-sink.md` — sink metadata resolution
  interacting with join output (CLM-3 territory).
- `bugs/031-changelog-walk-divergences.md` — the CLM-8 divergences,
  found while writing this spec.
