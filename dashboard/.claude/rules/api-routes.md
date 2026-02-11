---
globs: src/app/api/**
---

# API Route Conventions

## Proxy Pattern

All Flink REST calls go through Next.js API routes — never call Flink directly from the browser. Reasons:
- Flink REST API has no CORS headers
- Auth headers (Basic/Bearer) are injected server-side via `createFlinkFetcher(config)`
- Multiple Flink endpoints can be aggregated into a single browser request

## Mock Mode

Before hitting Flink, every route checks `config.mockMode`:
```typescript
const config = getConfig();
if (config.mockMode) {
  return NextResponse.json(generateMock...()); // from mock-api-responses.ts
}
```

Mock mode is auto-enabled when `FLINK_REST_URL` is not set. Can be forced via `DASHBOARD_MOCK_MODE=on|off`.

## Two-Phase Parallel Fetch (Job Detail Route)

The `/api/flink/jobs/[jobId]/detail` route aggregates 8+ Flink endpoints:

**Phase 1** — Independent endpoints via `Promise.all`:
- `/jobs/:jid`, `/jobs/:jid/exceptions`, `/jobs/:jid/checkpoints`, `/jobs/:jid/checkpoints/config`, `/jobs/:jid/config`

**Phase 2** — Per-vertex endpoints (needs vertex IDs from Phase 1):
- Critical: `/jobs/:jid/vertices/:vid` — errors propagate
- Supplementary: watermarks, backpressure, accumulators — use `.catch(() => fallback)` for graceful degradation

## Error Handling

- Critical endpoints: let errors propagate → caught by outer try/catch → 502 response with error message
- Supplementary endpoints: `.catch(() => fallback)` with empty/default data
- Browser-side `flink-api-client.ts` throws on non-OK responses, stores set `fetchError`

## Route Handler Signature

Next.js 15 dynamic route params are async:
```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
```
