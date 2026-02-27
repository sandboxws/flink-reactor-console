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

export interface FlinkFetcher {
  <T>(path: string): Promise<T>;
  text(path: string): Promise<string>;
  patch<T>(path: string): Promise<T>;
  post<T>(path: string, body?: Record<string, unknown>): Promise<T>;
  postForm<T>(path: string, formData: FormData): Promise<T>;
  delete(path: string): Promise<void>;
}

export function createFlinkFetcher(config: DashboardConfig): FlinkFetcher {
  const baseUrl = config.flinkRestUrl;
  if (!baseUrl) {
    throw new Error("FLINK_REST_URL is not configured");
  }

  const authHeaders = buildAuthHeaders(config);

  async function fetchFlink<T>(path: string): Promise<T> {
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
  }

  fetchFlink.patch = async function fetchFlinkPatch<T>(path: string): Promise<T> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method: "PATCH",
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

  fetchFlink.text = async function fetchFlinkText(path: string): Promise<string> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      headers: {
        Accept: "text/plain",
        ...authHeaders,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Flink API error: ${res.status} ${res.statusText}`);
    }

    return res.text();
  };

  fetchFlink.post = async function fetchFlinkPost<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...authHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Flink API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  };

  fetchFlink.postForm = async function fetchFlinkPostForm<T>(
    path: string,
    formData: FormData,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
      body: formData,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Flink API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  };

  fetchFlink.delete = async function fetchFlinkDelete(path: string): Promise<void> {
    const url = `${baseUrl}${path}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Flink API error: ${res.status} ${res.statusText}`);
    }
  };

  return fetchFlink as FlinkFetcher;
}
