import pc from "picocolors"
import type { TapManifest } from "@/core/types.js"

/** Outcome of a tap-manifest push. `message` is set on failure. */
export interface TapPushResult {
  readonly ok: boolean
  readonly message?: string
}

/**
 * Push a tap manifest to the reactor-console backend.
 *
 * Posts the manifest JSON to the console's REST API.
 * Never throws — returns `{ ok: false, message }` on failure.
 *
 * In quiet mode nothing is printed (JSON-mode callers route `message`
 * into their own output); otherwise progress/warnings go to stdout as
 * before.
 */
export async function pushTapManifest(
  manifest: TapManifest,
  consoleUrl: string,
  opts?: { quiet?: boolean },
): Promise<TapPushResult> {
  const url = `${consoleUrl.replace(/\/$/, "")}/api/tap-manifests`
  const quiet = opts?.quiet === true

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manifest),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      const message = `failed to push tap manifest (${response.status}): ${body}`
      if (!quiet) {
        console.log(pc.yellow(`  Warning: ${message}`))
      }
      return { ok: false, message }
    }

    if (!quiet) {
      console.log(
        pc.dim(`  Tap manifest pushed to console (${manifest.pipelineName})`),
      )
    }
    return { ok: true }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    const message = `could not push tap manifest: ${reason}`
    if (!quiet) {
      console.log(pc.yellow(`  Warning: ${message}`))
    }
    return { ok: false, message }
  }
}
