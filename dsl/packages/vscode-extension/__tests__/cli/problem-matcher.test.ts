// `$flink-reactor` problem-matcher fixture test (task 2.4) + manifest parity:
// sample diagnostic lines parse into file/line/column/severity/code entries,
// non-matching (human-readable) lines pass through, and the manifest's
// declared pattern is byte-identical to the module's (single source of truth).

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  PROBLEM_PATTERN_REGEXP,
  parseProblemLine,
} from "../../src/cli/problem-matcher"

describe("problem matcher pattern", () => {
  it("parses an error diagnostic line", () => {
    expect(
      parseProblemLine(
        "pipelines/orders/index.tsx:12:5 error FR-SCHEMA-001 Unknown column `amont` in Filter condition",
      ),
    ).toEqual({
      file: "pipelines/orders/index.tsx",
      line: 12,
      column: 5,
      severity: "error",
      code: "FR-SCHEMA-001",
      message: "Unknown column `amont` in Filter condition",
    })
  })

  it("parses a warning with an absolute path and an indented line", () => {
    expect(
      parseProblemLine(
        "  /work/app/pipelines/orders/index.tsx:3:1 warning FR-CONNECTOR-012 bootstrapServers not set",
      ),
    ).toEqual({
      file: "/work/app/pipelines/orders/index.tsx",
      line: 3,
      column: 1,
      severity: "warning",
      code: "FR-CONNECTOR-012",
      message: "bootstrapServers not set",
    })
  })

  it.each([
    ["✓ orders — valid"],
    ["    error: <KafkaSink> is missing required prop `topic`"], // human format: no file:line:col
    ["Validating 3 pipeline(s)..."],
    ["pipelines/orders/index.tsx:12:5 info FR-X not-a-matched-severity"],
  ])("passes a non-matching line through as plain output: %s", (line) => {
    expect(parseProblemLine(line)).toBeNull()
  })

  it("matches the pattern declared in the manifest (no drift)", () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
    ) as {
      contributes?: {
        problemMatchers?: readonly {
          name: string
          pattern: { regexp: string }
        }[]
      }
    }
    const matcher = manifest.contributes?.problemMatchers?.find(
      (m) => m.name === "flink-reactor",
    )
    expect(
      matcher,
      "manifest contributes a flink-reactor matcher",
    ).toBeDefined()
    expect(matcher?.pattern.regexp).toBe(PROBLEM_PATTERN_REGEXP)
  })
})
