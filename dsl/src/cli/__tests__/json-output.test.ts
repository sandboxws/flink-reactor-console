import { describe, expect, it } from "vitest"
import { serializeSynthError } from "@/cli/json-output.js"
import { ConfigError, DiscoveryError, ValidationError } from "@/core/errors.js"

describe("serializeSynthError", () => {
  it("flattens a tagged error with a message field", () => {
    const err = new DiscoveryError({
      reason: "config_not_found",
      message: "no flink-reactor.config.ts",
      path: "/tmp/project",
    })

    const serialized = serializeSynthError(err)

    expect(serialized.tag).toBe("DiscoveryError")
    expect(serialized.message).toBe("no flink-reactor.config.ts")
    expect(serialized.context).toMatchObject({
      reason: "config_not_found",
      path: "/tmp/project",
    })
    expect(serialized.context).not.toHaveProperty("message")
    expect(serialized.context).not.toHaveProperty("_tag")
  })

  it("gives ValidationError a stable fallback message and keeps diagnostics in context", () => {
    const err = new ValidationError({
      diagnostics: [
        { severity: "error", message: "Orphan source", nodeId: "src_1" },
      ],
    })

    const serialized = serializeSynthError(err)

    expect(serialized.tag).toBe("ValidationError")
    expect(serialized.message).toBe("validation failed")
    expect(serialized.context.diagnostics).toEqual([
      { severity: "error", message: "Orphan source", nodeId: "src_1" },
    ])
  })

  it("serializes ConfigError context fields verbatim", () => {
    const err = new ConfigError({
      reason: "missing_env_var",
      message: "KAFKA_BROKERS is not set",
    })

    const serialized = serializeSynthError(err)

    expect(serialized.tag).toBe("ConfigError")
    expect(serialized.message).toBe("KAFKA_BROKERS is not set")
    expect(serialized.context.reason).toBe("missing_env_var")
  })

  it("treats a plain Error as a defect", () => {
    const serialized = serializeSynthError(new Error("boom"))

    expect(serialized.tag).toBe("Defect")
    expect(serialized.message).toBe("boom")
    expect(serialized.context).toEqual({})
  })

  it("treats a thrown non-Error value as a defect", () => {
    const serialized = serializeSynthError("string throw")

    expect(serialized.tag).toBe("Defect")
    expect(serialized.message).toBe("string throw")
  })

  it("never includes a stack in the context", () => {
    const err = new DiscoveryError({
      reason: "import_failure",
      message: "cannot import",
      path: "/x",
    })

    expect(serializeSynthError(err).context).not.toHaveProperty("stack")
  })
})
