import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { NextResponse } from "next/server"
import { generateMockTapManifest } from "@/data/mock-tap-manifest"
import type { TapManifest } from "@/data/tap-types"
import { getConfig } from "@/lib/config"

/**
 * Default directory where `flink-reactor synth` outputs tap manifests.
 * Convention: each pipeline produces `{pipelineName}.tap-manifest.json`.
 */
const DEFAULT_MANIFEST_DIR = "./dist"

/**
 * GET /api/flink/tap-manifest — discover and serve tap manifests.
 *
 * Convention-over-configuration:
 * - Scans TAP_MANIFEST_DIR (default: ./dist/) for *.tap-manifest.json files
 * - ?pipeline=name  → returns the manifest matching that pipeline name
 * - No query param  → returns all discovered manifests as { manifests: [...] }
 *
 * Mock mode: returns a static mock manifest array.
 */
export async function GET(request: Request) {
  const config = getConfig()

  // Mock mode — return static mock manifest
  if (config.mockMode) {
    const mock = generateMockTapManifest()
    const { searchParams } = new URL(request.url)
    const pipeline = searchParams.get("pipeline")

    if (pipeline) {
      if (mock.pipelineName === pipeline) {
        return NextResponse.json(mock)
      }
      return NextResponse.json(
        { error: `No tap manifest found for pipeline "${pipeline}"` },
        { status: 404 },
      )
    }

    return NextResponse.json({ manifests: [mock] })
  }

  // Live mode — scan directory for *.tap-manifest.json files
  const manifestDir = resolve(
    process.env.TAP_MANIFEST_DIR ?? DEFAULT_MANIFEST_DIR,
  )

  // Read manifest files — missing directory or empty directory is normal
  // (user hasn't run synth yet), so return an empty list rather than an error.
  const manifests: TapManifest[] = []

  try {
    const entries = await readdir(manifestDir)
    const manifestFiles = entries.filter((f) =>
      f.endsWith(".tap-manifest.json"),
    )

    for (const file of manifestFiles) {
      const content = await readFile(join(manifestDir, file), "utf-8")
      manifests.push(JSON.parse(content) as TapManifest)
    }
  } catch (err) {
    // ENOENT = directory doesn't exist yet — not an error, just no manifests
    if (
      !(
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      )
    ) {
      const message =
        err instanceof Error ? err.message : "Failed to read tap manifests"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // Filter by pipeline name if requested
  const { searchParams } = new URL(request.url)
  const pipeline = searchParams.get("pipeline")

  if (pipeline) {
    const match = manifests.find((m) => m.pipelineName === pipeline)
    if (!match) {
      return NextResponse.json(
        {
          error: `No tap manifest found for pipeline "${pipeline}"`,
        },
        { status: 404 },
      )
    }
    return NextResponse.json(match)
  }

  return NextResponse.json({ manifests })
}
