import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { IsolatedRunner } from "../../src/synth/isolated-runner.js"
import type { SynthesisInput } from "../../src/synth/types.js"

// `fake-worker.mjs` echoes a result after `input.delayMs`, so we can make a
// "synthesis" take a controlled wall-clock time and observe which budget the
// runner applied (boot grace vs. the tight per-edit timeout).
const FAKE_WORKER = join(
  dirname(fileURLToPath(import.meta.url)),
  "fake-worker.mjs",
)

/** A synthesis input that makes the fake worker respond after `delayMs`. */
function delayed(delayMs: number): SynthesisInput {
  return { delayMs } as unknown as SynthesisInput
}

describe("IsolatedRunner cold-start boot grace", () => {
  let runner: IsolatedRunner
  afterEach(async () => {
    await runner?.dispose()
  })

  it("absorbs a slow FIRST synthesis under the boot grace", async () => {
    // 300ms response: over the tight 100ms timeout, under the 1500ms boot grace.
    runner = new IsolatedRunner({
      timeoutMs: 100,
      bootGraceMs: 1500,
      workerPath: FAKE_WORKER,
    })
    const first = await runner.synthesize(delayed(300))
    expect(first.ok).toBe(true)
  })

  it("applies the tight timeout once the worker is warm", async () => {
    runner = new IsolatedRunner({
      timeoutMs: 100,
      bootGraceMs: 1500,
      workerPath: FAKE_WORKER,
    })
    // First call warms the worker (boot grace covers the 300ms response)…
    const first = await runner.synthesize(delayed(300))
    expect(first.ok).toBe(true)
    // …so a second 300ms synthesis now exceeds the 100ms warm timeout.
    const second = await runner.synthesize(delayed(300))
    expect(second.ok).toBe(false)
    expect(second.loadError?.kind).toBe("timeout")
    expect(second.loadError?.message).toContain("100ms")
  })

  it("re-earns the boot grace after a respawn (timeout kills the worker)", async () => {
    runner = new IsolatedRunner({
      timeoutMs: 100,
      bootGraceMs: 1500,
      workerPath: FAKE_WORKER,
    })
    await runner.synthesize(delayed(300)) // warm
    const timedOut = await runner.synthesize(delayed(300)) // times out → worker killed
    expect(timedOut.loadError?.kind).toBe("timeout")
    // The next dispatch spawns a fresh (cold) worker, which earns the grace
    // again — a 300ms response succeeds rather than tripping the 100ms timeout.
    const afterRespawn = await runner.synthesize(delayed(300))
    expect(afterRespawn.ok).toBe(true)
  })
})
