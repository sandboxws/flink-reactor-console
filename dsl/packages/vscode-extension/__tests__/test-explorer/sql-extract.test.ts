// Snapshot-diff extraction (test-explorer §6.2): expected/received SQL
// reconstructed from a Vitest snapshot failure message; ordinary assertion
// failures yield no sides (the inline-message fallback, task 6.5).

import { describe, expect, it } from "vitest"
import {
  extractSnapshotSides,
  isSnapshotMismatch,
  stripAnsi,
} from "../../src/test-explorer/sql-extract"

const ESC = String.fromCharCode(27)

const SNAPSHOT_FAILURE = `Error: Snapshot \`orders pipeline > synthesizes stable SQL 1\` mismatched

- Expected
+ Received

  "CREATE TABLE \`orders\` (
    \`order_id\` BIGINT,
-   \`amount\` DECIMAL(10, 2)
+   \`amount\` DOUBLE
  ) WITH (
    'connector' = 'kafka'
  );

  INSERT INTO \`out\` SELECT * FROM \`orders\`;"

    at /work/app/tests/pipelines/orders.test.ts:21:17`

describe("snapshot-diff extraction", () => {
  it("classifies snapshot mismatches vs ordinary failures", () => {
    expect(isSnapshotMismatch(SNAPSHOT_FAILURE)).toBe(true)
    expect(
      isSnapshotMismatch("AssertionError: expected 'a' to match /TUMBLE/"),
    ).toBe(false)
  })

  it("reconstructs both sides with shared context lines", () => {
    const sides = extractSnapshotSides(SNAPSHOT_FAILURE)
    expect(sides).not.toBeNull()
    expect(sides?.expected).toContain("`amount` DECIMAL(10, 2)")
    expect(sides?.expected).not.toContain("`amount` DOUBLE")
    expect(sides?.received).toContain("`amount` DOUBLE")
    expect(sides?.received).not.toContain("DECIMAL(10, 2)")
    // Context lines appear on BOTH sides.
    for (const side of [sides?.expected, sides?.received]) {
      expect(side).toContain("CREATE TABLE `orders` (")
      expect(side).toContain("INSERT INTO `out` SELECT * FROM `orders`;")
    }
    // The stack frame is not part of either side.
    expect(sides?.received).not.toContain("at /work/app")
  })

  it("returns null for a failure with no diff body", () => {
    expect(
      extractSnapshotSides("AssertionError: expected 1 to be 2"),
    ).toBeNull()
  })

  it("strips ANSI escapes before parsing", () => {
    const colored = SNAPSHOT_FAILURE.replace(
      "- Expected",
      `${ESC}[32m- Expected${ESC}[39m`,
    )
    expect(stripAnsi(colored)).not.toContain(ESC)
    expect(extractSnapshotSides(colored)).not.toBeNull()
  })
})

describe("extractSidesFromOutput (default-reporter join)", () => {
  it("joins the diff body to the snapshot by its backticked name", async () => {
    const { extractSidesFromOutput, snapshotNameOf } = await import(
      "../../src/test-explorer/sql-extract"
    )
    const message =
      "Error: Snapshot `orders pipeline > synthesizes stable SQL 1` mismatched\n    at createMismatchError (file:///x.js:1:1)"
    const output = `
 FAIL  tests/pipelines/orders.test.ts > orders pipeline > synthesizes stable SQL
Error: Snapshot \`orders pipeline > synthesizes stable SQL 1\` mismatched

- Expected
+ Received

- "-- STALE --"
+ "CREATE TABLE x;
+
+ INSERT INTO y;"

 ❯ tests/pipelines/orders.test.ts:21:17

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
`
    const name = snapshotNameOf(message)
    expect(name).toBe("orders pipeline > synthesizes stable SQL 1")
    const sides = name ? extractSidesFromOutput(output, name) : null
    expect(sides?.expected).toContain("-- STALE --")
    expect(sides?.received).toContain("INSERT INTO y;")
    expect(sides?.received).not.toContain("STALE")
  })
})
