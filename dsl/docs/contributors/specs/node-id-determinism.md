# Node-ID determinism invariants

Spec ID prefix: `NID` | Status: active | Canonical for: how construct
nodes get their `id` and what determinism guarantees the scheme makes.

## Scope

Governs `generateNodeId` / `resetNodeIdCounter` / `toSqlIdentifier` in
`src/core/jsx-runtime.ts` and the language server's mirror
(`packages/language-server/src/mappers/id-predictor.ts`). Node IDs are
load-bearing: they become SQL table/view names, tap consumer-group
components, diagnostic anchors, and the LSP's position-mapping keys.

## Invariants

### NID-1: Named vs counter IDs
A node whose factory sets `_nameHint` MUST get
`id = toSqlIdentifier(nameHint)`. A node without a hint MUST get
`` `${component}_${counter}` `` from the module-level counter. Only
string-component `createElement` calls mint IDs — function components
delegate to their factory, which creates exactly one string-component
element.

`toSqlIdentifier`: replace `.`/`-`/`/` with `_`, strip every other
non-`[a-zA-Z0-9_]` character, trim leading/trailing underscores, collapse
runs of `_`.

### NID-2: Collision suffixes
When the base ID is taken, suffixes `_2`, `_3`, … MUST be appended in
first-seen order (the `usedNodeIds` set). The first occupant keeps the
bare name.

### NID-3: Every element advances the counter — including named ones
Each string-component `createElement` MUST advance the counter exactly
once, **whether or not the node is named** (`jsx-runtime.ts`: "keep
counter moving for unnamed nodes"). Load-bearing consequence: inserting
or removing *any* element — even a fully named source — shifts the ID of
every later unnamed node in the same session.

### NID-4: Determinism is relative to a reset point
IDs are deterministic only as a function of the complete
`createElement` call sequence since the last `resetNodeIdCounter()`.
Every independent synthesis session MUST call `resetNodeIdCounter()`
before evaluating pipeline modules — and the call MUST happen in the
**same module realm** the pipeline code loads into (the LSP imports the
reset through its project-anchored jiti for exactly this reason; a reset
in the host realm does not touch the project realm's counter).

### NID-5: The LSP predictor mirrors this spec in lockstep
`id-predictor.ts` re-derives IDs statically from the AST and MUST stay
byte-for-byte faithful to `generateNodeId` + `toSqlIdentifier` + the
per-component `_nameHint` rules (`NAME_HINT_RULES` must list exactly the
components that set `_nameHint`). Any change to the DSL side MUST update
the predictor and its parity test in the same change.

### NID-6: Multi-pipeline sessions drift by construction
When several pipeline modules are evaluated in one session without
per-module resets, counter-based IDs depend on the cross-module
evaluation order. Per-document predictions (which assume a fresh
counter) therefore cannot match — consumers MUST either reset per
pipeline or treat unmapped IDs as expected and degrade gracefully
(no-op navigation, not crashes).

## Rationale

The same pipeline must synthesize to the same SQL on every machine and
every run (CLAUDE.md determinism rule), and the LSP must locate a node's
JSX source position from nothing but its ID. Both collapse if IDs depend
on anything beyond the call sequence. NID-3 looks like a quirk but
removing it would renumber every existing snapshot and break the
predictor — it is part of the contract now.

## Enforced by

| Invariant | Test |
|---|---|
| NID-1, NID-2, NID-3 | `src/core/__tests__/jsx-runtime.test.ts` |
| NID-4 | `src/codegen/__tests__/determinism.test.ts`; scaffolded-template test contract (`resetNodeIdCounter()` in `beforeEach` — `docs/contributors/template-conventions.md`) |
| NID-5 | `packages/language-server/__tests__/parity.test.ts` ("source-position predictor parity (critical gate)") |
| NID-6 | language-server mapper tests (graceful no-op branches) |

## Violations seen historically

- `bugs/009-chained-joins-reference-intermediate-node-id.md` — generated
  SQL referenced an intermediate node's ID as a table name (NID-1's
  "IDs are load-bearing" consequence).
- LSP node-ID drift across multi-pipeline worker sessions (NID-4/NID-6):
  worker counter state diverged from fresh per-document predictions,
  silently unmapping nodes until the realm-anchored reset landed.
