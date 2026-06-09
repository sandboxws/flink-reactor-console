# Black-box CLI e2e suite

Runs the **packed artifact** (`pnpm pack` → tarball → real `pnpm install`
into isolated temp projects) as a subprocess. Never imports repo `src/` —
the vitest config has no `@` alias on purpose, so any such import fails
to resolve. This is the only suite that catches packaging-class bugs:
deps missing from the published artifact, broken bin shims, `exports`
map mistakes, version-injection failures.

```bash
pnpm test:e2e        # default suite (4 representative templates)
pnpm test:e2e:all    # nightly: full 17-template matrix (FR_E2E_ALL=1)
```

## Env knobs

| Var | Effect |
|---|---|
| `FR_E2E_SKIP_BUILD=1` | reuse existing `dist/` (CI builds first) |
| `FR_E2E_BIN=<path>` | scaffold with a prebuilt CLI entry instead of the tarball install |
| `FR_E2E_KEEP=1` | keep temp dirs after the run (paths printed) |

## What's deliberately out of scope

Anything needing Docker or host services: `up`, `down`, `deploy`, `dev`,
`sim`, `cluster`, and `doctor` (host-dependent probe results). The suite
stays hermetic — filesystem + subprocess only.

## Conventions

- Template names and expected pipelines live in `helpers/templates.ts`
  as deliberate literals; a rename breaking this suite is the signal.
- Assertions target exit codes and artifact files; prose is matched by
  at most one loose regex per test.
- The determinism check encodes TAP-7/ORD-5
  (`docs/contributors/specs/`): `generatedAt` in the tap manifest is the
  only byte allowed to differ between identical synth runs.
