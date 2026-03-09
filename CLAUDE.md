# flink-reactor-console

Dashboard + Server for FlinkReactor. A combined repo containing the React dashboard and Go GraphQL server.

## What This Repo Contains

- `dashboard/` — TanStack Router + Zustand + Tailwind v4 dashboard (React SPA)
- `server/` — Go GraphQL server (reactor-server) with Flink REST proxy
- `packages/ui/` — Shared UI component library (@flink-reactor/ui)
- `tools/ui-embeddings/` — LanceDB embeddings for UI component search

## Architecture

- **Data flow**: Flink REST → Go server (GraphQL) → Dashboard
- **GraphQL contract**: Schema lives in `server/internal/graphql/schema/`, codegen in `dashboard/codegen.ts`
- **Docker build**: Server binary embeds dashboard static build (`dashboard/out/` → `server/dashboard/`)
- **Proxy pattern**: All Flink REST calls go through the Go server (auth injection, aggregation, no CORS)

## Commands

```bash
# Dashboard
pnpm dev                  # Dashboard dev server
pnpm build                # Build UI + dashboard

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
- `dashboard/.claude/rules/api-routes.md` — Proxy pattern, mock mode
- `dashboard/.claude/rules/components.md` — Page delegation, styling, store access

## Related Repositories

| Repo | Purpose | License |
|------|---------|---------|
| `flink-reactor-dsl` | Core DSL + CLI | BSL 1.1 |
| **`flink-reactor-console`** | **Dashboard + Server (this repo)** | **BSL 1.1** |
| `flink-reactor-platform` | Docs + orchestration | BSL 1.1 |
| `flink-reactor-specs` | Specifications | BSL 1.1 |
