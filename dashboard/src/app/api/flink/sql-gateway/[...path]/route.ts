import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

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

function generateMockResultResponse(): object {
  return {
    results: {
      columns: [
        { name: "id", logicalType: { type: "BIGINT", nullable: false } },
        { name: "name", logicalType: { type: "VARCHAR(255)", nullable: true } },
        { name: "value", logicalType: { type: "DOUBLE", nullable: true } },
      ],
      data: [
        { kind: "INSERT", fields: [1, "mock-row-1", 42.5] },
        { kind: "INSERT", fields: [2, "mock-row-2", 99.1] },
        { kind: "INSERT", fields: [3, "mock-row-3", 17.3] },
      ],
    },
    resultType: "EOS",
    nextResultUri: null,
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
  if (/\/operations\/[^/]+\/result\/\d+$/.test(path) && method === "GET") {
    return generateMockResultResponse();
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
