// Vitest JSON parsing (test-explorer §3.4) + the watch stream extractor:
// tolerant of unknown fields, null-safe, and unparseable input → null
// (task 10.4's "couldn't parse" path).

import { describe, expect, it } from "vitest"
import {
  extractJsonDocuments,
  parseVitestJson,
} from "../../src/test-explorer/json-parse"

const SAMPLE = JSON.stringify({
  success: false,
  unknownTopLevel: 1,
  testResults: [
    {
      name: "/work/app/tests/pipelines/orders.test.ts",
      extra: true,
      assertionResults: [
        {
          ancestorTitles: ["orders pipeline"],
          title: "synthesizes stable SQL",
          fullName: "orders pipeline > synthesizes stable SQL",
          status: "failed",
          duration: 12.5,
          failureMessages: ["Error: Snapshot `…` mismatched"],
        },
        {
          ancestorTitles: ["orders pipeline"],
          title: "validates",
          status: "passed",
          duration: 3,
          failureMessages: [],
        },
        {
          ancestorTitles: [],
          title: "skipped one",
          status: "pending",
          failureMessages: [],
        },
      ],
    },
  ],
})

describe("parseVitestJson", () => {
  it("maps assertion results to per-test records", () => {
    const summary = parseVitestJson(SAMPLE)
    expect(summary?.success).toBe(false)
    expect(summary?.records).toHaveLength(3)
    const [fail, pass, skip] = summary?.records ?? []
    expect(fail).toMatchObject({
      file: "/work/app/tests/pipelines/orders.test.ts",
      fullName: "orders pipeline > synthesizes stable SQL",
      title: "synthesizes stable SQL",
      state: "fail",
      duration: 12.5,
    })
    expect(fail?.failureMessages[0]).toMatch(/mismatched/)
    expect(pass?.state).toBe("pass")
    expect(skip?.state).toBe("skip")
    expect(skip?.fullName).toBe("skipped one")
  })

  it("returns null for unparseable or non-Vitest payloads", () => {
    expect(parseVitestJson("not json")).toBeNull()
    expect(parseVitestJson('{"foo": 1}')).toBeNull()
    expect(parseVitestJson("[1,2]")).toBeNull()
  })
})

describe("extractJsonDocuments", () => {
  it("pulls complete run documents out of a mixed stream", () => {
    const doc = '{"testResults":[],"success":true}'
    const stream = `vitest noise\n${doc}\nmore noise {"other":1} ${doc.slice(0, 10)}`
    const { documents, rest } = extractJsonDocuments(stream)
    expect(documents).toEqual([doc])
    // The trailing incomplete document is kept for the next chunk.
    expect(rest).toBe(doc.slice(0, 10))
  })

  it("handles braces inside strings", () => {
    const doc =
      '{"testResults":[{"name":"a{b}.test.ts","assertionResults":[]}]}'
    const { documents } = extractJsonDocuments(doc)
    expect(documents).toEqual([doc])
  })
})
