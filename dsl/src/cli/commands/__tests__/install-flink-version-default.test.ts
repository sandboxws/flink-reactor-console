import { describe, expect, it } from "vitest"
import { DEFAULT_FLINK_VERSION } from "@/cli/commands/install.js"
import { createProgram } from "@/cli/program.js"

/**
 * Guards against the `--help` text and the runtime default drifting apart
 * (#4: help advertised 1.20 while the CLI installed 2.3). Both now derive
 * from DEFAULT_FLINK_VERSION, so this asserts the registered option's help
 * text is built from that constant.
 */
describe("install flink --flink-version default", () => {
  const flinkCommand = createProgram()
    .commands.find((c) => c.name() === "install")
    ?.commands.find((c) => c.name() === "flink")

  it("registers the flink install subcommand", () => {
    expect(flinkCommand).toBeDefined()
  })

  it("advertises the real default in --help", () => {
    const option = flinkCommand?.options.find(
      (o) => o.long === "--flink-version",
    )
    expect(option).toBeDefined()
    expect(option?.description).toBe(
      `Flink version (default: ${DEFAULT_FLINK_VERSION})`,
    )
    expect(option?.description).toContain(DEFAULT_FLINK_VERSION)
  })

  it("pins the shipped default", () => {
    expect(DEFAULT_FLINK_VERSION).toBe("2.3")
  })
})
