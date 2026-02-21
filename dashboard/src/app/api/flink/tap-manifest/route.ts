import { NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getConfig } from "@/lib/config";
import { generateMockTapManifest } from "@/data/mock-tap-manifest";
import type { TapManifest } from "@/data/tap-types";

/**
 * Default directory where `flink-reactor synth` outputs tap manifests.
 * Convention: each pipeline produces `{pipelineName}.tap-manifest.json`.
 */
const DEFAULT_MANIFEST_DIR = "./dist";

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
  const config = getConfig();

  // Mock mode — return static mock manifest
  if (config.mockMode) {
    const mock = generateMockTapManifest();
    const { searchParams } = new URL(request.url);
    const pipeline = searchParams.get("pipeline");

    if (pipeline) {
      if (mock.pipelineName === pipeline) {
        return NextResponse.json(mock);
      }
      return NextResponse.json(
        { error: `No tap manifest found for pipeline "${pipeline}"` },
        { status: 404 },
      );
    }

    return NextResponse.json({ manifests: [mock] });
  }

  // Live mode — scan directory for *.tap-manifest.json files
  const manifestDir = resolve(
    process.env.TAP_MANIFEST_DIR ?? DEFAULT_MANIFEST_DIR,
  );

  try {
    const entries = await readdir(manifestDir);
    const manifestFiles = entries.filter((f) =>
      f.endsWith(".tap-manifest.json"),
    );

    if (manifestFiles.length === 0) {
      return NextResponse.json(
        {
          error: `No tap manifests found in ${manifestDir}. Run "flink-reactor synth" with tapped operators to generate them.`,
        },
        { status: 404 },
      );
    }

    // Parse all manifests
    const manifests: TapManifest[] = [];
    for (const file of manifestFiles) {
      const content = await readFile(join(manifestDir, file), "utf-8");
      manifests.push(JSON.parse(content) as TapManifest);
    }

    // Filter by pipeline name if requested
    const { searchParams } = new URL(request.url);
    const pipeline = searchParams.get("pipeline");

    if (pipeline) {
      const match = manifests.find((m) => m.pipelineName === pipeline);
      if (!match) {
        return NextResponse.json(
          {
            error: `No tap manifest found for pipeline "${pipeline}". Available: ${manifests.map((m) => m.pipelineName).join(", ")}`,
          },
          { status: 404 },
        );
      }
      return NextResponse.json(match);
    }

    return NextResponse.json({ manifests });
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json(
        {
          error: `Manifest directory not found: ${manifestDir}. Run "flink-reactor synth" to generate tap manifests.`,
        },
        { status: 404 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to read tap manifests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
