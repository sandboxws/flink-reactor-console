---
globs: src/lib/graphql-*
---

# GraphQL Data Layer

## Go Backend Integration

All Flink data flows through the Go backend's GraphQL API (`server/`). The dashboard never calls Flink REST directly.

- **urql client** (`src/lib/graphql-client.ts`): Configured with `VITE_GRAPHQL_URL` (dev: `http://localhost:8080/graphql`, prod: relative `/graphql`)
- **API client** (`src/lib/graphql-api-client.ts`): Typed wrapper functions over GraphQL queries, consumed by Zustand stores
- **No mock mode**: the backend always talks to a real Flink cluster. `server/internal/flink/mock.go` is test-only (httptest) and cannot be switched on at runtime.

## Error Handling

- GraphQL errors surface as thrown exceptions in the API client
- Stores catch errors and set `fetchError` / `*Error` state (stale data stays visible)
- Supplementary data (watermarks, backpressure) degrades gracefully on failure
