// ── Kafka Schema Registry introspection ─────────────────────────────
// Fetches a subject's latest schema from a Confluent Schema Registry and
// turns it into `IntrospectedColumn[]`. A thin `fetch` shell — all schema
// parsing lives in the driver-free codegen mappers
// (`avro-types` / `json-schema-types`) so it can be unit-tested without a
// network and reused by the browser/LSP.
//
// Results are cached for the process lifetime, mirroring
// `postgres-introspect.ts`, so repeated generations against the same
// subject don't re-hit the registry.

import { avroRecordToColumns } from "@/codegen/connectors/avro-types.js"
import { jsonSchemaToColumns } from "@/codegen/connectors/json-schema-types.js"
import type { IntrospectedColumn } from "@/codegen/schema-introspect.js"

export interface IntrospectRegistryOptions {
  /** Schema Registry base URL, e.g. `http://localhost:8081`. */
  readonly registryUrl: string
  /** Topic name — used to derive the default subject `<topic>-value`. */
  readonly topic: string
  /** Explicit subject override (skips TopicNameStrategy derivation). */
  readonly subject?: string
  /** Basic auth for managed registries (e.g. Confluent Cloud). */
  readonly auth?: { readonly username: string; readonly password: string }
}

export type RegistryIntrospectResult = readonly IntrospectedColumn[]

/** Confluent default subject naming (TopicNameStrategy). */
export function defaultSubject(topic: string): string {
  return `${topic}-value`
}

// ── Cache ───────────────────────────────────────────────────────────

const cache = new Map<string, RegistryIntrospectResult>()

/** Reset the in-memory cache. Primarily for tests. */
export function resetRegistryIntrospectCache(): void {
  cache.clear()
}

// ── Public API ──────────────────────────────────────────────────────

interface RegistrySchemaResponse {
  readonly schema: string
  readonly schemaType?: "AVRO" | "JSON" | "PROTOBUF"
}

/**
 * Fetch and map a subject's latest schema to introspected columns.
 *
 * Supports AVRO and JSON schema types. Protobuf subjects throw a clear
 * error (unsupported in v1). Columns come back in the schema's field
 * declaration order (deterministic).
 */
export async function introspectKafkaSubject(
  opts: IntrospectRegistryOptions,
): Promise<RegistryIntrospectResult> {
  const subject = opts.subject ?? defaultSubject(opts.topic)
  const baseUrl = opts.registryUrl.replace(/\/+$/, "")
  const key = `${baseUrl}::${subject}`

  const cached = cache.get(key)
  if (cached) return cached

  const url = `${baseUrl}/subjects/${encodeURIComponent(subject)}/versions/latest`
  const headers: Record<string, string> = {
    Accept: "application/vnd.schemaregistry.v1+json",
  }
  if (opts.auth) {
    const token = Buffer.from(
      `${opts.auth.username}:${opts.auth.password}`,
    ).toString("base64")
    headers.Authorization = `Basic ${token}`
  }

  let response: Awaited<ReturnType<typeof fetch>>
  try {
    response = await fetch(url, { headers })
  } catch (err) {
    throw new Error(
      `Failed to reach the Schema Registry at ${baseUrl}: ${(err as Error).message}`,
    )
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Subject '${subject}' not found in the Schema Registry at ${baseUrl}. ` +
          "Check the topic name, or set an explicit `subject` on the source.",
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Schema Registry authentication failed (HTTP ${response.status}) for ${baseUrl}. ` +
          "Set `auth` credentials on the source (username/password).",
      )
    }
    let snippet = "<no response body>"
    try {
      snippet = (await response.text()).slice(0, 200)
    } catch {
      // ignore — keep the placeholder snippet
    }
    throw new Error(
      `Schema Registry request failed (HTTP ${response.status}) for subject '${subject}': ${snippet}`,
    )
  }

  const payload = (await response.json()) as RegistrySchemaResponse
  // Confluent omits `schemaType` for Avro (the default).
  const schemaType = payload.schemaType ?? "AVRO"

  if (schemaType === "PROTOBUF") {
    throw new Error(
      `Subject '${subject}' is a Protobuf schema, which isn't supported in v1. ` +
        "Declare this source's schema manually.",
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(payload.schema)
  } catch (err) {
    throw new Error(
      `Could not parse the ${schemaType} schema for subject '${subject}': ${(err as Error).message}`,
    )
  }

  const columns =
    schemaType === "JSON"
      ? jsonSchemaToColumns(parsed)
      : avroRecordToColumns(parsed)

  cache.set(key, columns)
  return columns
}
