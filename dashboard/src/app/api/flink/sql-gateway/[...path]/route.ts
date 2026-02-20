import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { generateMockTapManifest, generateMockStreamingRows } from "@/data/mock-tap-manifest";

/**
 * Catch-all proxy route for SQL Gateway v1 REST API.
 *
 * Forwards requests to the SQL Gateway at SQL_GATEWAY_URL
 * (falls back to FLINK_REST_URL host with port 8083).
 *
 * Pattern matches: /api/flink/sql-gateway/v1/sessions, /api/flink/sql-gateway/v1/sessions/:id/statements, etc.
 */

function getSqlGatewayBaseUrl(): string | null {
  // Explicit SQL Gateway URL takes priority
  const explicit = process.env.SQL_GATEWAY_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Fall back: derive from FLINK_REST_URL by swapping the port to 8083
  const flinkUrl = process.env.FLINK_REST_URL;
  if (flinkUrl) {
    try {
      const url = new URL(flinkUrl);
      url.port = "8083";
      return url.toString().replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  return null;
}

// ── Mock responses for mock mode ──────────────────────────────────────────

function generateMockSessionResponse(): object {
  return { sessionHandle: `mock-session-${crypto.randomUUID().slice(0, 8)}` };
}

function generateMockStatementResponse(): object {
  return { operationHandle: `mock-op-${crypto.randomUUID().slice(0, 8)}` };
}

function generateMockStatusResponse(): object {
  return { status: "FINISHED" };
}

/**
 * Generate mock result response for SQL Gateway operations.
 *
 * For tap observation queries, returns streaming-style results (PAYLOAD)
 * with realistic data matching the tap manifest schema. Each request
 * returns new rows, simulating live streaming from Kafka.
 *
 * The first result page (token 0) includes column metadata.
 * Subsequent pages return additional rows.
 */
function generateMockResultResponse(
  sessionHandle: string,
  operationHandle: string,
  resultToken: number,
): object {
  // Use the first tap operator's schema for realistic column/data generation
  const manifest = generateMockTapManifest();
  // Pick the enriched-orders-sink (has the most columns) for mock streaming
  const tap = manifest.taps[2] ?? manifest.taps[0];
  const schema = tap.schema;

  const columns = Object.entries(schema).map(([name, type]) => ({
    name,
    logicalType: { type, nullable: type !== "BIGINT" },
  }));

  // Generate 2-5 rows per page to simulate streaming
  const batchSize = 2 + (resultToken % 4);
  const rows = generateMockStreamingRows(schema, batchSize);
  const columnNames = Object.keys(schema);

  const data = rows.map((row) => ({
    kind: "INSERT" as const,
    fields: columnNames.map((col) => row[col] ?? null),
  }));

  // Always return PAYLOAD (streaming) — the client decides when to stop
  const nextToken = resultToken + 1;

  return {
    results: {
      columns: resultToken === 0 ? columns : undefined,
      data,
    },
    resultType: "PAYLOAD",
    nextResultUri: `v1/sessions/${sessionHandle}/operations/${operationHandle}/result/${nextToken}`,
  };
}

function getMockResponse(path: string, method: string): object | null {
  // POST /v1/sessions → open session
  if (path === "v1/sessions" && method === "POST") {
    return generateMockSessionResponse();
  }
  // POST /v1/sessions/:id/statements → submit statement
  if (/^v1\/sessions\/[^/]+\/statements$/.test(path) && method === "POST") {
    return generateMockStatementResponse();
  }
  // GET /v1/sessions/:id/operations/:id/status → poll status
  if (/\/operations\/[^/]+\/status$/.test(path) && method === "GET") {
    return generateMockStatusResponse();
  }
  // GET /v1/sessions/:id/operations/:id/result/:token → fetch results
  {
    const resultMatch = path.match(
      /^v1\/sessions\/([^/]+)\/operations\/([^/]+)\/result\/(\d+)$/,
    );
    if (resultMatch && method === "GET") {
      return generateMockResultResponse(
        resultMatch[1],
        resultMatch[2],
        Number.parseInt(resultMatch[3], 10),
      );
    }
  }
  // DELETE /v1/sessions/:id → close session
  if (/^v1\/sessions\/[^/]+$/.test(path) && method === "DELETE") {
    return {};
  }
  // POST /v1/sessions/:id/operations/:id/cancel → cancel
  if (/\/operations\/[^/]+\/cancel$/.test(path) && method === "POST") {
    return {};
  }

  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────

async function proxyHandler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const subPath = path.join("/");
  const config = getConfig();

  // Mock mode
  if (config.mockMode) {
    const mock = getMockResponse(subPath, request.method);
    if (mock) {
      return NextResponse.json(mock);
    }
    return NextResponse.json(
      { error: `Mock not available for: ${request.method} ${subPath}` },
      { status: 404 },
    );
  }

  // Live mode — proxy to SQL Gateway
  const baseUrl = getSqlGatewayBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "SQL Gateway URL not configured. Set SQL_GATEWAY_URL or FLINK_REST_URL.",
      },
      { status: 502 },
    );
  }

  const targetUrl = `${baseUrl}/${subPath}`;

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // Forward Content-Type for POST/PUT/PATCH
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const res = await fetch(targetUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "DELETE"
          ? await request.text()
          : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    // Forward the response
    const responseBody = await res.text();
    return new NextResponse(responseBody, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "SQL Gateway unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const DELETE = proxyHandler;
export const PUT = proxyHandler;
