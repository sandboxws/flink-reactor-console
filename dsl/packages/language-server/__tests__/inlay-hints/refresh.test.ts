import { describe, expect, it } from "vitest"
import { createInlayHintRefresher } from "../../src/inlay-hints/refresh"

describe("createInlayHintRefresher", () => {
  it("5.3 a synthesis completion triggers exactly one refresh", () => {
    let sent = 0
    const refresher = createInlayHintRefresher({
      refreshSupported: () => true,
      send: () => {
        sent += 1
        return Promise.resolve(null)
      },
    })
    refresher.onSynthesized()
    expect(sent).toBe(1)
    // One refresh per synthesis — three syntheses, three refreshes, no
    // batching surprises and no extras.
    refresher.onSynthesized()
    refresher.onSynthesized()
    expect(sent).toBe(3)
  })

  it("5.1 no refresh is sent when the client lacks refreshSupport", () => {
    let sent = 0
    const refresher = createInlayHintRefresher({
      refreshSupported: () => false,
      send: () => {
        sent += 1
        return Promise.resolve(null)
      },
    })
    refresher.onSynthesized()
    expect(sent).toBe(0)
  })

  it("a rejected refresh is swallowed, never unhandled", async () => {
    const refresher = createInlayHintRefresher({
      refreshSupported: () => true,
      send: () => Promise.reject(new Error("client gone")),
    })
    refresher.onSynthesized()
    // Give the rejection a microtask turn; an unhandled rejection would fail
    // the test run.
    await new Promise((resolve) => setImmediate(resolve))
  })
})
