# flink-reactor-console

Dashboard + Server + DSL for FlinkReactor. A combined repo containing the React dashboard, the Go GraphQL server, and the TSX DSL + CLI.

## What This Repo Contains

- `dashboard/` — TanStack Router + Zustand + Tailwind v4 dashboard (React SPA)
- `server/` — Go GraphQL server (reactor-server) with Flink REST proxy
- `dsl/` — `@flink-reactor/dsl`: TSX DSL + `flink-reactor` CLI, plus `dsl/packages/*` (scaffolder, ts-plugin, language-server, VS Code extension) — see `dsl/CLAUDE.md`
- `packages/ui/` — Shared UI component library (@flink-reactor/ui)
- `tools/ui-embeddings/` — LanceDB embeddings for UI component search

The repo is self-contained: no sibling checkout is needed to build it, and there
is no `go.work`.

## Architecture

- **Data flow**: Flink REST → Go server (GraphQL) → Dashboard
- **GraphQL contract**: Schema lives in `server/internal/graphql/schema/`, codegen in `dashboard/codegen.ts`
- **Docker build**: `just docker` builds the dashboard, rsyncs `dashboard/dist/` → `server/dashboard/`, and copies it into the image. The dashboard is served from disk, not `go:embed`.
- **Proxy pattern**: All Flink REST calls go through the Go server (auth injection, aggregation, no CORS)
- **Instruments**: connectors to the systems around a job (Kafka, database, YugabyteDB, Redis, Schema Registry, Fluss, datalake). Go side in `server/internal/instruments/`, UI in `dashboard/src/components/instruments/`. YugabyteDB is a first-class instrument kind that reuses the Postgres engine of the `database` instrument (YSQL is Postgres-wire-compatible).

## Commands

```bash
# Dashboard
pnpm dev                  # Dashboard dev server
pnpm build                # Build dsl + UI + dashboard (topological)

# DSL (or run the unprefixed commands from dsl/)
pnpm build:dsl            # Build @flink-reactor/dsl + its packages
pnpm test:dsl             # DSL vitest suite
pnpm local:publish        # Publish dsl packages to local Verdaccio (external-install testing)

# Server (from server/)
just dev                  # Run Go server
just build                # Build binary
just test                 # Go tests
just lint                 # golangci-lint
just generate             # gqlgen codegen

# Shared
pnpm lint                 # Biome check all TS
pnpm ui:embed             # Rebuild UI embeddings
```

## Go Conventions

- **Formatter**: gofumpt (stricter than gofmt)
- **Import groups**: stdlib → external → internal
- **Error handling**: always check returned errors
- **Linters**: errcheck, govet, staticcheck, gosec, revive, unused, ineffassign
- **PostToolUse hook**: golangci-lint runs automatically after editing Go files

## Sub-Package Documentation

- `dashboard/CLAUDE.md` — Dashboard architecture, data flow, styling
- `dashboard/FLINK_REST_API.md` — Flink REST endpoint catalog
- `server/CLAUDE.md` — Server architecture
- `packages/ui/CLAUDE.md` — UI component reference

## Path-Scoped Rules

- `dashboard/.claude/rules/data-layer.md` — Type layers, mapper conventions
- `dashboard/.claude/rules/api-routes.md` — Proxy pattern, GraphQL data layer
- `dashboard/.claude/rules/components.md` — Page delegation, styling, store access

## Specs (OpenSpec)

Specs for this project live in a separate repository at `~/Development/reactors/flink/flink-reactor-specs`. When `/opsx:*` commands are invoked with an absolute path (e.g. `/opsx:apply /Users/ahmed/Development/reactors/flink/flink-reactor-specs/openspec/changes/fr-console-01-storage-foundation`), use that path directly to locate the change artifacts — do NOT attempt to find or run `openspec` CLI commands against the current working directory.

## Related Repositories

| Repo | Purpose | License |
|------|---------|---------|
| **`flink-reactor-console`** | **Dashboard + Server + DSL (this repo)** | **BSL 1.1** |
| `flink-reactor-platform` | Docs + orchestration | BSL 1.1 |
| `flink-reactor-specs` | Specifications | BSL 1.1 |

`flink-reactor-instruments` was merged into this repo and retired. Its Go
packages live in `server/internal/instruments/` and its UI in
`dashboard/src/components/instruments/`.

`flink-reactor-dsl` was merged into this repo and retired. The DSL + CLI live
in `dsl/` with full git history; its npm packages publish from here via the
root changesets pipeline.
