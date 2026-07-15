# flink-reactor-instruments

Infrastructure instruments subsystem for FlinkReactor. A Go + TypeScript monorepo providing pluggable instrument backends and their UI components.

## What This Repo Contains

- `server/` — Go module (`github.com/sandboxws/flink-reactor-instruments`) with core instrument interfaces, registry, and implementations
- `packages/instruments-ui/` — `@flink-reactor/instruments-ui` TypeScript package with React components and route exports

## Architecture

- **Go server**: Defines the `Instrument` interface (9 methods), `Registry` for lifecycle management, and concrete implementations (database, kafka)
- **TypeScript UI**: Exports React components, a Zustand store, and GraphQL API functions. Components accept `LinkComponent` and `activePath` props for router-agnostic integration
- **Plugin pattern**: The console imports this module and wires it in — thin route stubs delegate to exported route components

## Commands

```bash
# Go server (from server/)
go build ./...           # Build all packages
go test ./...            # Run tests

# TypeScript (from packages/instruments-ui/)
pnpm build               # Build with tsup
pnpm typecheck            # TypeScript check
```

## Go Package Structure

```
server/
├── instruments.go       # Instrument interface, Capability, ResourceRef, InstrumentInfo
├── config.go            # InstrumentConfig
├── registry.go          # Registry with HealthReporter injection
├── database/            # Database instrument (PostgreSQL, MySQL)
│   ├── instrument.go    # Instrument implementation
│   ├── client.go        # Query executor + history
│   ├── driver.go        # Driver interface
│   ├── postgres.go      # PostgreSQL driver
│   ├── mysql.go         # MySQL driver
│   ├── history.go       # Query history ring buffer
│   └── highlight.go     # SQL resource extraction
└── kafka/               # Kafka instrument
    ├── instrument.go    # Instrument implementation
    ├── client.go        # Topic/consumer group client
    └── highlight.go     # Kafka resource extraction
```

## TypeScript Package API

```ts
// Initialization (call once at app startup)
initInstrumentsUI({ graphqlClient })

// Route components (plain React, receive params as props)
InstrumentsIndexRoute, InstrumentDetailRoute,
DatabaseSchemasRoute, DatabaseQueryRoute, DatabaseTableRoute

// Sidebar integration
InstrumentSidebarSection  // accepts collapsed, activePath, LinkComponent

// Store
useInstrumentStore        // Zustand store for instrument list
```

## Key Patterns

- **HealthReporter**: Interface injected into Registry via functional options. The console provides a Prometheus adapter
- **LinkComponent prop**: All navigation components accept a `LinkComponent` prop instead of importing a specific router
- **GraphQL client init**: `initInstrumentsUI({ graphqlClient })` sets a module-level urql Client used by all API functions
- **Router-agnostic routes**: Route components receive params as props, not via `Route.useParams()`

## Adding a New Instrument

1. Create `server/<name>/` with Go implementation of `Instrument` interface
2. Create `packages/instruments-ui/src/components/<name>/` with React components
3. Add route components to `packages/instruments-ui/src/routes/`
4. Update icon map in `instrument-icons.tsx`
5. Export from `index.ts`
6. In the console: add registration case in `main.go`, thin route stubs, bump dependency

## Related Repositories

| Repo | Purpose |
|------|---------|
| `flink-reactor-console` | Dashboard + Server (consumes this package) |
| `flink-reactor-dsl` | Core DSL + CLI |
| `flink-reactor-platform` | Docs + orchestration |
| `flink-reactor-specs` | Specifications |
