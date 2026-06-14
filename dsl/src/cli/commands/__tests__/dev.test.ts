import type { FSWatcher } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { cleanupDev, type DevState } from "@/cli/commands/dev.js"

/**
 * `cleanupDev` was extracted from `shutdown()` precisely so the teardown path
 * is testable: `shutdown()` still calls `process.exit(0)` (which would kill
 * the test runner), but `cleanupDev` performs all the actual cleanup and
 * returns, leaving the exit boundary to the caller.
 */

function makeState(overrides: Partial<DevState> = {}): DevState {
  return {
    projectDir: "/tmp/project",
    cluster: false, // skip best-effort runtime teardown (needs a real adapter)
    port: "8081",
    watchers: [],
    shuttingDown: false,
    ...overrides,
  }
}

describe("cleanupDev", () => {
  it("closes + clears watchers, flags shutdown, and releases stdin", async () => {
    const removeListeners = vi
      .spyOn(process.stdin, "removeAllListeners")
      .mockReturnValue(process.stdin)
    const pause = vi
      .spyOn(process.stdin, "pause")
      .mockReturnValue(process.stdin)

    const close1 = vi.fn()
    const close2 = vi.fn()
    const w1 = { close: close1 } as unknown as FSWatcher
    const w2 = { close: close2 } as unknown as FSWatcher
    const state = makeState({ watchers: [w1, w2] })

    await cleanupDev(state)

    expect(close1).toHaveBeenCalledOnce()
    expect(close2).toHaveBeenCalledOnce()
    expect(state.watchers).toEqual([])
    expect(state.shuttingDown).toBe(true)
    expect(removeListeners).toHaveBeenCalledWith("data")
    expect(pause).toHaveBeenCalled()

    removeListeners.mockRestore()
    pause.mockRestore()
  })

  it("resolves cleanly with no watchers and cluster disabled", async () => {
    const removeListeners = vi
      .spyOn(process.stdin, "removeAllListeners")
      .mockReturnValue(process.stdin)
    const pause = vi
      .spyOn(process.stdin, "pause")
      .mockReturnValue(process.stdin)

    const state = makeState()
    await expect(cleanupDev(state)).resolves.toBeUndefined()
    expect(state.shuttingDown).toBe(true)

    removeListeners.mockRestore()
    pause.mockRestore()
  })
})
