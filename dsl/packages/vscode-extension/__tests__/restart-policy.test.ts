import { describe, expect, it } from "vitest"
import { decideRestart } from "../src/client/restart-policy.js"

const NOW = 1_000_000_000_000

describe("decideRestart", () => {
  it("restarts on the first crash", () => {
    const d = decideRestart([NOW], NOW)
    expect(d.action).toBe("restart")
    expect(d.delayMs).toBe(1_000)
    expect(d.reason).toContain("1/5")
  })

  it("still restarts at exactly the limit (5 in window)", () => {
    const crashes = [0, 1, 2, 3, 4].map((i) => NOW - i * 1_000)
    const d = decideRestart(crashes, NOW)
    expect(d.action).toBe("restart")
    expect(d.reason).toContain("5/5")
  })

  it("gives up once the window holds more than the limit", () => {
    const crashes = [0, 1, 2, 3, 4, 5].map((i) => NOW - i * 1_000)
    const d = decideRestart(crashes, NOW)
    expect(d.action).toBe("stop")
    expect(d.reason).toContain("6 crashes")
  })

  it("ignores crashes older than the 3-minute window", () => {
    const stale = [1, 2, 3, 4, 5].map((i) => NOW - 200_000 - i * 1_000)
    const d = decideRestart([...stale, NOW], NOW)
    expect(d.action).toBe("restart")
    expect(d.reason).toContain("1/5")
  })
})
