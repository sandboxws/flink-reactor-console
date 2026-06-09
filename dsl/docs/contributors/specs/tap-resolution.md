# Tap-resolution invariants

Spec ID prefix: `TAP` | Status: active | Canonical for: which nodes get
taps, what the tap manifest contains, and its determinism guarantees.

## Scope

Governs tap derivation and manifest generation (`src/core/tap.ts`,
`generateTapManifest` in `src/codegen/sql/sql-generator.ts`, the
`synthesizeApp` call sites in `src/core/app.ts`) and the sibling-chain
connector resolution feeding it. Does not govern the console-side tap
runtime.

## Invariants

### TAP-1: Auto-tap is derived, never stored
A node is auto-tapped iff `devMode && node.kind === "Sink" &&
!props.tap`, evaluated at manifest-generation time. Tap derivation MUST
NOT mutate node props — re-synthesizing the same tree with different
options yields different taps from identical props.

### TAP-2: synthesizeApp currently hardcodes dev mode
Both `generateTapManifest` call sites in `synthesizeApp`
(`src/core/app.ts`) pass `devMode: true`, so every CLI synth emits sink
taps; `noTap` is the only off-switch on that path.
(`generateTapManifest` itself defaults `devMode` to `false`.) This is the
recorded current contract — production-mode plumbing through
`synthesizeApp` is a known gap, not an accident to "fix" silently.

### TAP-3: Taps never modify production SQL
Observation SQL (`CREATE TEMPORARY TABLE` + `SELECT`) MUST live only in
the tap manifest. The `statements`/`sql` output of `generateSql` MUST be
byte-identical with and without taps.

### TAP-4: Deterministic observation artifacts
Consumer group IDs MUST follow
`fr-tap-{pipelineName}-{nodeId}-{deterministicShortHash(pipelineName:nodeId)}`
(an explicit `groupIdPrefix` replaces the `fr-tap-{pipelineName}` part).
Observation WITH-clause keys MUST be emitted sorted. Observation schema
columns MUST preserve the user's declaration order — they become a
`CREATE TABLE` in that exact order; do not sort.

### TAP-5: Tap timestamps require an explicit timezone
`startTimestamp`/`endTimestamp` MUST be ISO-8601 with `Z` or `±HH:MM`.
TZ-less strings are validation errors: `new Date("…T00:00:00")` parses as
*local* time, so the same input would emit different
`scan.startup.timestamp-millis` on a UTC runner vs a PST laptop.

### TAP-6: Connector context resolves via children; unknown is loud
A tapped node's connector properties resolve by walking its children
(nested topology). Sibling-chain transforms have no children, so they
resolve to connector `"unknown"`. That MUST surface as a warning
diagnostic (via TAP-8) — never a silent drop. (Historically these taps
disappeared silently; the warning *is* the fix's contract.)

### TAP-7: `generatedAt` is the only run-variant field
`manifest.generatedAt` MUST be `options.synthesizedAt` when provided,
else the sentinel `1970-01-01T00:00:00.000Z`. CLI paths pass real wall
time; tests/snapshots leave it unset. Consequently the tap manifest is
the ONLY synth artifact permitted to differ between identical runs, and
only in this one field. (The black-box e2e determinism check encodes
exactly this.)

### TAP-8: Unsupported observation strategies warn and skip
Connectors whose strategy resolves to `unsupported` (`filesystem`,
unknown connectors) MUST emit a warning diagnostic and produce no tap
entry. A manifest with zero taps is `null`, not an empty manifest.

## Rationale

Taps exist for observability; they must never change what runs in
production (TAP-3) and must be reproducible enough to diff (TAP-4/5/7).
Derivation-not-storage (TAP-1) keeps the construct tree a pure function
of user code — the same tree object can be synthesized for dev and prod.
The loud-unknown rule (TAP-6/8) exists because silent drops cost a
debugging session before anyone noticed the taps were missing.

## Enforced by

| Invariant | Test |
|---|---|
| TAP-1, TAP-2 | `src/core/__tests__/tap.test.ts` ("generateTapMetadata - dev mode" / "- prod mode") |
| TAP-3 | `src/core/__tests__/tap.test.ts` (identical-SQL assertions), `src/codegen/__tests__/determinism.test.ts` |
| TAP-4 | `src/core/__tests__/tap.test.ts` ("buildConsumerGroupId", observation SQL suites) |
| TAP-5 | `src/core/__tests__/tap.test.ts` ("validateTapConfig", timestamp suites) |
| TAP-6 | `src/core/__tests__/sibling-chain.test.ts` |
| TAP-7 | `src/codegen/__tests__/determinism.test.ts` ("default sentinel keeps output deterministic") |
| TAP-8 | `src/core/__tests__/tap.test.ts` ("resolveObservationStrategy", unsupported suites) |

## Violations seen historically

- Sibling-chain transform taps silently dropped (pre-warning behavior;
  TAP-6's reason to exist).
- `synthesizeApp` hardcoding `devMode: true` shipped all-sinks-tapped
  manifests to every environment (TAP-2 records this as the current,
  known contract rather than an invariant violation).
