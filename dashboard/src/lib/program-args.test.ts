import { describe, expect, it } from "vitest"
import { parseProgramArgs } from "./program-args"

describe("parseProgramArgs", () => {
  it("returns one token per non-empty line", () => {
    expect(parseProgramArgs("--input\ns3://bucket/in\n--rate\n10")).toEqual([
      "--input",
      "s3://bucket/in",
      "--rate",
      "10",
    ])
  })

  it("keeps a value with spaces as a single token", () => {
    expect(parseProgramArgs("--query\nSELECT * FROM t WHERE x > 1")).toEqual([
      "--query",
      "SELECT * FROM t WHERE x > 1",
    ])
  })

  it("drops blank lines and trims surrounding whitespace", () => {
    expect(parseProgramArgs("  --a  \n\n\t\n  b\n")).toEqual(["--a", "b"])
  })

  it("returns an empty array for empty or whitespace-only input", () => {
    expect(parseProgramArgs("")).toEqual([])
    expect(parseProgramArgs("   \n  \n")).toEqual([])
  })

  it("handles CRLF line endings", () => {
    expect(parseProgramArgs("--a\r\n--b")).toEqual(["--a", "--b"])
  })
})
