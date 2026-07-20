// Argument-vector construction (cli-lifecycle-integration tasks 1.5/3.5):
// descriptors print deterministically, `--env` appears only when active, and
// the stable identity keys task reuse.

import { describe, expect, it } from "vitest"
import {
  buildArgs,
  descriptorIdentity,
  LIFECYCLE_VERBS,
  PIPELINE_SCOPED_VERBS,
} from "../../src/cli/command-descriptor"

describe("buildArgs", () => {
  it("builds Synth with pipeline, env, and synth flags", () => {
    expect(
      buildArgs({
        verb: "synth",
        pipeline: "orders",
        env: "production",
        flags: ["-o", "out", "--deep-validate"],
      }),
    ).toEqual([
      "synth",
      "-p",
      "orders",
      "--env",
      "production",
      "-o",
      "out",
      "--deep-validate",
    ])
  })

  it("builds Validate without --env when no environment is active", () => {
    expect(buildArgs({ verb: "validate", pipeline: "orders" })).toEqual([
      "validate",
      "-p",
      "orders",
    ])
  })

  it("builds Deploy with --env and no pipeline (project-wide)", () => {
    expect(buildArgs({ verb: "deploy", env: "staging" })).toEqual([
      "deploy",
      "--env",
      "staging",
    ])
  })

  it("covers the full v1 verb set", () => {
    expect([...LIFECYCLE_VERBS]).toEqual([
      "synth",
      "validate",
      "graph",
      "schema",
      "deploy",
      "up",
      "down",
      "status",
      "stop",
      "resume",
      "savepoint",
      "doctor",
      "dev",
    ])
    expect(PIPELINE_SCOPED_VERBS.has("synth")).toBe(true)
    expect(PIPELINE_SCOPED_VERBS.has("doctor")).toBe(false)
    expect(PIPELINE_SCOPED_VERBS.has("dev")).toBe(false)
  })
})

describe("descriptorIdentity", () => {
  it("keys by verb + pipeline + env so re-runs reuse one task", () => {
    const a = descriptorIdentity({ verb: "synth", pipeline: "orders" })
    const b = descriptorIdentity({ verb: "synth", pipeline: "orders" })
    const c = descriptorIdentity({
      verb: "synth",
      pipeline: "orders",
      env: "prod",
    })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
