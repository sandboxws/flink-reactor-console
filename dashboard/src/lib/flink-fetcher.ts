// ---------------------------------------------------------------------------
// Server-side Flink REST API fetcher — handles auth, SSL, and timeouts.
// This module runs ONLY on the server (Next.js API routes).
// ---------------------------------------------------------------------------

import type { DashboardConfig } from "./config";

function buildAuthHeaders(config: DashboardConfig): Record<string, string> {
  if (config.authType === "basic" && config.authUsername && config.authPassword) {
    const encoded = Buffer.from(
      `${config.authUsername}:${config.authPassword}`,
    ).toString("base64");
    return { Authorization: `Basic ${encoded}` };
  }

  if (config.authType === "token" && config.authToken) {
    return { Authorization: `Bearer ${config.authToken}` };
  }

  return {};
}

export function createFlinkFetcher(config: DashboardConfig) {
  const baseUrl = config.flinkRestUrl;
  if (!baseUrl) {
    throw new Error("FLINK_REST_URL is not configured");
  }

  const authHeaders = buildAuthHeaders(config);

  return async function fetchFlink<T>(path: string): Promise<T> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Flink API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  };
}
