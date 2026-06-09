# Behavioral invariant specs

This directory holds the standing behavioral contracts of the DSL's core
subsystems — the rules that must stay true across refactors, and that more
than one implementation (codegen, validation, LSP) may depend on
simultaneously.

## How specs relate to their neighbors

| Location | Holds | Lifetime |
|---|---|---|
| `openspec/` (change workflow) | Proposed deltas to behavior | Until archived |
| `bugs/` | Incident reports: what broke, why, how fixed | Historical record |
| `docs/contributors/specs/` | Standing contracts: what must always hold | Permanent, evolves in place |

A bug that reveals a missing invariant should add one here. A change
proposal that alters an invariant must update the spec in the same PR.

## Convention

- **IDs** are `PREFIX-N` (`ORD-`, `CLM-`, `NID-`, `TAP-`). IDs are
  **append-only**: never renumber, never reuse. A retired invariant stays
  in the file struck through with a one-line tombstone explaining what
  replaced it.
- Each invariant is one **MUST / MUST NOT** sentence, optionally followed
  by a rule table or short elaboration when the rule is conditional.
- Required sections per spec file: **Scope**, **Invariants**,
  **Rationale**, **Enforced by** (invariant → test table), **Violations
  seen historically** (links into `bugs/`).
- The spec file is **canonical for the contract**; code implements it,
  tests enforce it. When code and spec disagree, one of them is wrong —
  figure out which and fix that one (often the answer is "file a bug").

## Referencing invariants from tests

Add a comment above the pinning `describe`/`it` block:

```ts
// Spec: ORD-3 (docs/contributors/specs/statement-ordering.md)
```

Comments only — never rename tests or snapshot keys for spec linkage;
that churns snapshot files and CI history for zero benefit.

## Current specs

| Spec | Prefix | Governs |
|---|---|---|
| [statement-ordering.md](statement-ordering.md) | `ORD` | SQL statement emission order and byte stability |
| [changelog-propagation.md](changelog-propagation.md) | `CLM` | append-only/retract derivation and flow |
| [node-id-determinism.md](node-id-determinism.md) | `NID` | construct-node ID assignment |
| [tap-resolution.md](tap-resolution.md) | `TAP` | tap derivation, manifests, determinism |
