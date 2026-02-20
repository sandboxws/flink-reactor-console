import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getConfig } from "@/lib/config";
import { generateMockTapManifest } from "@/data/mock-tap-manifest";

/**
 * GET /api/flink/tap-manifest — serves the tap manifest JSON.
 *
 * In mock mode: returns a static mock manifest with sample operators.
 * In live mode: reads from TAP_MANIFEST_PATH (local file path or URL).
 */
export async function GET() {
  const config = getConfig();

  // Mock mode — return static mock manifest
  if (config.mockMode) {
    return NextResponse.json(generateMockTapManifest());
  }

  // Live mode — read from configured path
  const manifestPath = process.env.TAP_MANIFEST_PATH;

  if (!manifestPath) {
    return NextResponse.json(
      {
        error:
          "TAP_MANIFEST_PATH is not configured. Set this environment variable to the path or URL of your tap-manifest.json.",
      },
      { status: 404 },
    );
  }

  try {
    let manifestJson: string;

    if (manifestPath.startsWith("http://") || manifestPath.startsWith("https://")) {
      // Fetch from URL
      const res = await fetch(manifestPath, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to fetch tap manifest from ${manifestPath}: ${res.status}` },
          { status: 502 },
        );
      }
      manifestJson = await res.text();
    } else {
      // Read from local file
      manifestJson = await readFile(manifestPath, "utf-8");
    }

    const manifest: unknown = JSON.parse(manifestJson);
    return NextResponse.json(manifest);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read tap manifest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
