# BUG-031: Validation and codegen changelog walks diverge (SessionWindow, anti/semi joins)

## Affected

Any pipeline where a `SessionWindow` or an anti/semi `Join` sits between
a source and a sink. Found while writing `docs/contributors/specs/changelog-propagation.md`
(CLM-8); no user-reported incident yet.

## Symptom

`validate` passes a topology whose generated DDL is retract-shaped:

- The **codegen** walk (`src/codegen/sql/sql-sink-metadata.ts`) forces
  retract for `SessionWindow` (sessions can merge on late events) and for
  anti/semi joins (the result set changes when the right side changes),
  so sink DDL gets upsert/PK treatment — or should have been rejected.
- The **validation** walk (`src/core/changelog-propagation.ts`) treats
  `Window` kind as passthrough and decides `Join` kind purely from input
  modes, so `validateChangelogModes` computes append-only for the same
  topology and raises no CLM-7 diagnostic.

Net effect: an append-only-shaped sink (e.g. plain `KafkaSink` without
PK) downstream of a SessionWindow aggregate or anti-join validates clean,
then fails (or mis-behaves) at Flink submit time instead of at synth time.

## Root Cause

Two independent implementations of the propagation rules with no
agreement test between them (CLM-3 in
`docs/contributors/specs/changelog-propagation.md`). The codegen walk gained the
SessionWindow and anti/semi rules; the validation walk never did.

## Repro sketch

```tsx
// SessionWindow case: validation says append-only, codegen says retract
<Pipeline name="p">
  <KafkaSource topic="t" schema={S} />            {/* append-only */}
  <SessionWindow gap="10 minutes" timeColumn="ts">
    <Aggregate groupBy={["k"]} aggregations={{ c: "COUNT(*)" }} />
  </SessionWindow>
  <KafkaSink topic="out" />                        {/* no PK */}
</Pipeline>
```

`validateChangelogModes` → no diagnostics.
`resolveSinkMetadata` → sink mode `retract` (→ upsert-kafka emission path,
which then needs a PK it may not have — the BUG-011 surface).

## Proposed fix

The codegen walk encodes the correct Flink semantics. Fix the validation
walk in `src/core/changelog-propagation.ts`:

1. `computeNodeOutputMode`: `SessionWindow` component → `"retract"`
   (before the generic `Window` kind passthrough).
2. `Join` kind: `props.type === "anti" || props.type === "semi"` →
   `"retract"` regardless of input modes.
3. Add the CLM-3 agreement test: for a fixture set covering every CLM-4
   row, assert `computeChangelogModes` sink mode ===
   `resolveSinkMetadata` sink mode.

Then fold the rules into the CLM-4 table and tombstone CLM-8.
