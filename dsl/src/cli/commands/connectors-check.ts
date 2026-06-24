import type { Command } from "commander"
import pc from "picocolors"
import {
  artifactToJarName,
  artifactToMavenUrl,
  listConnectorIds,
  listFormatIds,
  listJdbcDialects,
  type MavenArtifact,
  resolveConnectorArtifacts,
  resolveFormatArtifacts,
  resolveJdbcDialectArtifacts,
  SUPPORTED_FLINK_VERSIONS,
} from "@/codegen/connector-registry.js"
import type { FlinkMajorVersion } from "@/core/types.js"

const DEFAULT_VERSION: FlinkMajorVersion = "2.3"
const USER_AGENT = "flink-reactor-connectors-check"

type ArtifactStatus = "available" | "missing" | "error"

interface CheckRow {
  category: string
  source: string
  jar: string
  url: string
  reused: boolean
  status: ArtifactStatus
  httpCode?: number
}

/**
 * Runtime/plugin JARs that ship with the Flink image rather than via the
 * connector registry. Their version tracks the Flink patch release, which we
 * approximate as `<major>.0` (e.g. 2.3 → 2.3.0).
 */
function runtimeArtifacts(
  version: FlinkMajorVersion,
): { source: string; artifact: MavenArtifact }[] {
  const full = `${version}.0`
  return [
    {
      source: "s3-fs-native",
      artifact: {
        groupId: "org.apache.flink",
        artifactId: "flink-s3-fs-native",
        version: full,
      },
    },
    {
      source: "metrics-prometheus",
      artifact: {
        groupId: "org.apache.flink",
        artifactId: "flink-metrics-prometheus",
        version: full,
      },
    },
  ]
}

/** Extract an embedded Flink major (1.20 / 2.x) from a coordinate, if any. */
function embeddedMajor(a: MavenArtifact): string | undefined {
  const m = `${a.artifactId} ${a.version}`.match(/(?:^|[^\d.])(1\.20|2\.\d+)/)
  return m?.[1]
}

function isReused(a: MavenArtifact, requested: FlinkMajorVersion): boolean {
  const embedded = embeddedMajor(a)
  return embedded !== undefined && embedded !== requested
}

function gatherArtifacts(
  version: FlinkMajorVersion,
): { category: string; source: string; artifact: MavenArtifact }[] {
  const out: { category: string; source: string; artifact: MavenArtifact }[] =
    []
  for (const id of listConnectorIds()) {
    for (const a of resolveConnectorArtifacts(id, version)) {
      out.push({ category: "connector", source: id, artifact: a })
    }
  }
  for (const id of listFormatIds()) {
    for (const a of resolveFormatArtifacts(id, version)) {
      out.push({ category: "format", source: id, artifact: a })
    }
  }
  for (const d of listJdbcDialects()) {
    for (const a of resolveJdbcDialectArtifacts(d.urlPattern, version)) {
      out.push({ category: "jdbc", source: d.dialect, artifact: a })
    }
  }
  for (const r of runtimeArtifacts(version)) {
    out.push({ category: "runtime", source: r.source, artifact: r.artifact })
  }
  return out
}

async function headCheck(
  url: string,
): Promise<{ status: ArtifactStatus; httpCode?: number }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
    })
    if (res.status === 200) return { status: "available", httpCode: 200 }
    if (res.status === 404) return { status: "missing", httpCode: 404 }
    return { status: "error", httpCode: res.status }
  } catch {
    return { status: "error" }
  }
}

async function checkVersion(version: FlinkMajorVersion): Promise<CheckRow[]> {
  const gathered = gatherArtifacts(version)

  // Dedup by URL — multiple connectors/formats can resolve the same jar.
  const byUrl = new Map<
    string,
    { category: string; source: string; artifact: MavenArtifact }
  >()
  for (const g of gathered) {
    const url = artifactToMavenUrl(g.artifact)
    if (!byUrl.has(url)) byUrl.set(url, g)
  }

  const rows = await Promise.all(
    [...byUrl.entries()].map(async ([url, g]): Promise<CheckRow> => {
      const { status, httpCode } = await headCheck(url)
      return {
        category: g.category,
        source: g.source,
        jar: artifactToJarName(g.artifact),
        url,
        reused: isReused(g.artifact, version),
        status,
        httpCode,
      }
    }),
  )

  rows.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.source.localeCompare(b.source),
  )
  return rows
}

function renderRows(version: FlinkMajorVersion, rows: CheckRow[]): void {
  console.log("")
  console.log(
    pc.bold(`Connector / runtime JAR availability — Flink ${version}`),
  )

  let lastCategory = ""
  for (const row of rows) {
    if (row.category !== lastCategory) {
      console.log(pc.cyan(`  ${row.category}`))
      lastCategory = row.category
    }
    const icon =
      row.status === "available"
        ? pc.green("✓")
        : row.status === "missing"
          ? pc.red("✗")
          : pc.yellow("?")
    const reuse = row.reused ? pc.yellow(" (reused — no native build)") : ""
    console.log(
      `    ${icon} ${pc.dim(row.source.padEnd(18))} ${row.jar}${reuse}`,
    )
  }

  const missing = rows.filter((r) => r.status === "missing").length
  const errored = rows.filter((r) => r.status === "error").length
  const reused = rows.filter((r) => r.reused).length
  console.log(
    pc.dim(
      `  ${rows.length} jars · ${rows.length - missing - errored} available · ${missing} missing · ${errored} unreachable · ${reused} reused`,
    ),
  )
}

export function registerConnectorsCommand(program: Command): void {
  const connectors = program
    .command("connectors")
    .description(
      "Inspect connector / runtime JAR availability on Maven Central",
    )

  connectors
    .command("check", { isDefault: true })
    .description(
      "Check whether the JARs the DSL resolves for a Flink version exist on Maven Central",
    )
    .option(
      "-f, --flink <version>",
      `Flink version to check (default ${DEFAULT_VERSION})`,
    )
    .option("--all", "Check across every supported Flink version")
    .option("--json", "Emit machine-readable JSON instead of a table")
    .option("--strict", "Exit non-zero if any resolved JAR is missing")
    .action(async (opts: Record<string, unknown>) => {
      const versions: FlinkMajorVersion[] = opts.all
        ? [...SUPPORTED_FLINK_VERSIONS]
        : [resolveVersion(opts.flink as string | undefined)]

      const results: { version: FlinkMajorVersion; rows: CheckRow[] }[] = []
      for (const version of versions) {
        results.push({ version, rows: await checkVersion(version) })
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2))
      } else {
        for (const { version, rows } of results) renderRows(version, rows)
      }

      const anyMissing = results.some((r) =>
        r.rows.some((row) => row.status === "missing"),
      )
      if (opts.strict && anyMissing) {
        process.exitCode = 1
      }
    })
}

function resolveVersion(value: string | undefined): FlinkMajorVersion {
  if (
    value &&
    (SUPPORTED_FLINK_VERSIONS as readonly string[]).includes(value)
  ) {
    return value as FlinkMajorVersion
  }
  if (value) {
    console.warn(
      pc.yellow(
        `Unknown Flink version '${value}'; falling back to ${DEFAULT_VERSION}. Supported: ${SUPPORTED_FLINK_VERSIONS.join(", ")}`,
      ),
    )
  }
  return DEFAULT_VERSION
}
