import { describe, expect, it } from "vitest"
import {
  editDistance,
  nearestCandidate,
  suggestionThreshold,
} from "../../src/diagnostics/did-you-mean"

describe("editDistance", () => {
  it("computes classic Levenshtein distances", () => {
    expect(editDistance("user_id", "user_id")).toBe(0)
    expect(editDistance("usr_id", "user_id")).toBe(1) // insert 'e'
    expect(editDistance("amont", "amount")).toBe(1) // insert 'u'
    expect(editDistance("kitten", "sitting")).toBe(3)
    expect(editDistance("", "abc")).toBe(3)
  })
})

describe("suggestionThreshold", () => {
  it("is small and scales with identifier length", () => {
    expect(suggestionThreshold("id")).toBe(2)
    expect(suggestionThreshold("user_id")).toBe(2)
    expect(suggestionThreshold("a_very_long_column_name")).toBeGreaterThan(2)
  })
})

describe("nearestCandidate", () => {
  it("suggests the nearest column for a near-miss typo", () => {
    const got = nearestCandidate("usr_id", ["user_id", "order_id", "amount"])
    expect(got?.candidate).toBe("user_id")
    expect(got?.distance).toBe(1)
  })

  it("returns nothing when no candidate is within threshold", () => {
    expect(
      nearestCandidate("qqqqqq", ["user_id", "order_id", "amount"]),
    ).toBeUndefined()
  })

  it("ignores an exact match (not a 'did you mean')", () => {
    // The only other candidate is far away, so the exact match yields nothing.
    expect(nearestCandidate("amount", ["amount", "zzzzzz"])).toBeUndefined()
  })

  it("ranks case-insensitively but returns the original spelling", () => {
    const got = nearestCandidate("Amont", ["amount", "AMOUNT_2"])
    expect(got?.candidate).toBe("amount")
  })

  it("breaks ties toward the earliest candidate", () => {
    // Both 'aa' and 'bb' are distance 1 from 'ab'; the first wins.
    const got = nearestCandidate("ab", ["aa", "bb"])
    expect(got?.candidate).toBe("aa")
  })
})
