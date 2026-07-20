# dsl/ — FlinkReactor DSL + CLI

Core DSL library + CLI (`@flink-reactor/dsl`). React-style TSX DSL that synthesizes to Flink SQL + Kubernetes FlinkDeployment CRDs. Formerly the standalone `flink-reactor-dsl` repo, now a workspace member of this monorepo; its npm packages version and publish independently via the root changesets pipeline.

## What This Directory Contains

- `src/` — Core DSL engine, components, codegen, CLI, testing utilities
- `packages/create-fr-app/` — Project scaffolder (`create-fr-app`)
- `packages/ts-plugin/` — TypeScript language service plugin
- `packages/language-server/` — LSP backend (`flink-reactor-lsp`)
- `packages/vscode-extension/` — VS Code extension (private: ships via vsce, not npm)
- `scripts/` — Build and local Verdaccio publish scripts

## Architecture Rules

- **Synthesis only** — no runtime code executes inside Flink. We generate SQL strings and YAML.
- **Custom JSX, not React** — `createElement()` builds a construct tree, not a virtual DOM.
- **DAG, not tree** — pipelines are directed acyclic graphs. JSX nesting is sugar for the linear case only.
- **Deterministic output** — same input must always produce the same SQL and YAML.
- **Flink SQL is the target** — all components compile to Flink SQL (v0.1). No DataStream API.
- **Invariant specs** — behavioral contracts live in [`docs/contributors/specs/`](docs/contributors/specs/README.md) with stable IDs (`ORD-`/`CLM-`/`NID-`/`TAP-`); cite the ID when changing statement ordering, changelog propagation, node-id assignment, or tap behavior.

## Code Conventions

- TypeScript strict mode, no `any`
- Component files: `.ts` (they export node factories, not JSX components)
- Pipeline entry points: `pipelines/*/index.tsx` (these use JSX)
- Generated SQL: backtick-quote all identifiers
- Flink types: uppercase strings (`'BIGINT'`, `'TIMESTAMP(3)'`)
- No default exports except pipeline entry points and config files
- Tests: Vitest, snapshot tests for SQL output (`toMatchSnapshot()`)
- Scaffolder templates (`src/cli/templates/`) follow [`docs/contributors/template-conventions.md`](docs/contributors/template-conventions.md) — README + per-pipeline test contract

## Commands

Run from `dsl/` (root equivalents: `pnpm build:dsl`, `pnpm test:dsl`, `pnpm test:dsl:e2e`, `pnpm typecheck:dsl`, `pnpm local:publish`).

```bash
pnpm build          # Build with tsup (also builds packages/*)
pnpm test           # Run tests with vitest
pnpm test:e2e       # Black-box CLI e2e (packs the artifact, runs it as a subprocess)
pnpm lint           # Biome check (nested config — stricter than the repo root)
pnpm format         # Biome format
pnpm local:publish  # Publish to local Verdaccio (localhost:4873)
```

Versioning and npm releases happen at the repo root: `pnpm changeset`,
`pnpm version-packages`, `pnpm release` (CI-run).
