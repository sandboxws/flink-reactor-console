import { describe, expect, it } from "vitest"
import {
  highlightYamlLine,
  type YamlSegment,
} from "../../src/preview/crd-blocks"

/** The segments must reconstruct the input line byte-for-byte (the renderer
 *  rebuilds the line from them as text nodes). */
function join(segs: readonly YamlSegment[]): string {
  return segs.map((s) => s.text).join("")
}

function classOf(
  segs: readonly YamlSegment[],
  text: string,
): string | undefined {
  return segs.find((s) => s.text === text)?.cls
}

describe("highlightYamlLine", () => {
  it("never drops or alters bytes", () => {
    for (const line of [
      "kind: FlinkDeployment",
      "  parallelism: 4",
      "    - name: orders",
      "# a comment",
      "  flinkConfiguration:",
      "metadata: {}",
      "",
      "    image: 'flink:1.20'",
    ]) {
      expect(join(highlightYamlLine(line))).toBe(line)
    }
  })

  it("classifies a key and its colon", () => {
    const segs = highlightYamlLine("kind: FlinkDeployment")
    expect(classOf(segs, "kind")).toBe("key")
    expect(classOf(segs, ":")).toBe("punct")
  })

  it("classifies quoted strings and numbers", () => {
    const str = highlightYamlLine("  image: 'flink:1.20'")
    expect(classOf(str, "'flink:1.20'")).toBe("string")

    const num = highlightYamlLine("  parallelism: 4")
    expect(classOf(num, "4")).toBe("number")

    const bool = highlightYamlLine("  upsertEnabled: true")
    expect(classOf(bool, "true")).toBe("number")
  })

  it("handles list markers and keeps the key after them", () => {
    const segs = highlightYamlLine("    - name: orders")
    expect(classOf(segs, "-")).toBe("punct")
    expect(classOf(segs, "name")).toBe("key")
  })

  it("treats whole-line and inline comments as comments", () => {
    expect(classOf(highlightYamlLine("# top"), "# top")).toBe("comment")
    const inline = highlightYamlLine("replicas: 1 # one")
    expect(classOf(inline, "1")).toBe("number")
    expect(classOf(inline, " # one")).toBe("comment")
  })
})
