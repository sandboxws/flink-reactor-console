import { StatementExecutionError } from "@flink-reactor/dsl/node"
import { describe, expect, it } from "vitest"
import {
  type GatewayClientLike,
  GatewayValidator,
  isSkippableStatement,
} from "../../src/gateway/deep-validate"

/** A scriptable in-memory gateway: explain succeeds unless the statement
 *  contains a `fail:` marker, whose suffix becomes the planner message. */
function stubGateway() {
  const calls = { openSession: 0, explain: [] as string[], closeSession: 0 }
  const client: GatewayClientLike = {
    openSession: () => {
      calls.openSession += 1
      return Promise.resolve(`session-${calls.openSession}`)
    },
    explainInSession: (_session, dml) => {
      calls.explain.push(dml)
      const marker = /fail:([\w ']+)/.exec(dml)
      if (marker) {
        return Promise.reject(
          new StatementExecutionError({
            statement: dml,
            message: marker[1],
            fullMessage: `org.apache.flink.table.api.ValidationException: ${marker[1]}\n\tat …`,
            rootCause: marker[1],
          }),
        )
      }
      return Promise.resolve("== Optimized Plan ==")
    },
    closeSession: () => {
      calls.closeSession += 1
      return Promise.resolve()
    },
  }
  return { client, calls }
}

const signal = () => new AbortController().signal

describe("isSkippableStatement", () => {
  it("2.1 skips comment banners, SET statements, and STATEMENT SET wrappers", () => {
    expect(isSkippableStatement("-- ====\n-- SOURCES\n-- ====")).toBe(true)
    expect(isSkippableStatement("SET 'pipeline.name' = 'p';")).toBe(true)
    expect(isSkippableStatement("EXECUTE STATEMENT SET BEGIN")).toBe(true)
    expect(isSkippableStatement("STATEMENT SET BEGIN")).toBe(true)
    expect(isSkippableStatement("-- banner\nCREATE TABLE `t` (`a` INT)")).toBe(
      false,
    )
    expect(isSkippableStatement("INSERT INTO `t` SELECT 1")).toBe(false)
  })
})

describe("GatewayValidator", () => {
  it("2.5 clean statements yield no errors", async () => {
    const { client, calls } = stubGateway()
    const validator = new GatewayValidator(() => client)
    const outcome = await validator.validate(
      "http://gw",
      ["-- banner", "SET 'a' = 'b';", "CREATE TABLE `t` (`a` INT)"],
      signal(),
    )
    expect(outcome).toEqual({ kind: "ok", errors: [] })
    // Only the plannable statement was EXPLAINed.
    expect(calls.explain).toEqual(["CREATE TABLE `t` (`a` INT)"])
  })

  it("2.5 a failing statement yields one error retaining its index and message", async () => {
    const { client } = stubGateway()
    const validator = new GatewayValidator(() => client)
    const outcome = await validator.validate(
      "http://gw",
      [
        "-- banner",
        "CREATE TABLE `ok` (`a` INT)",
        "INSERT INTO `t` SELECT fail:missing column", // index 2 fails
      ],
      signal(),
    )
    expect(outcome.kind).toBe("ok")
    if (outcome.kind !== "ok") return
    expect(outcome.errors).toHaveLength(1)
    expect(outcome.errors[0].statementIndex).toBe(2)
    expect(outcome.errors[0].message).toBe("missing column")
    expect(outcome.errors[0].detail?.rootCause).toBe("missing column")
  })

  it("2.2 one session is opened lazily and reused across passes", async () => {
    const { client, calls } = stubGateway()
    const validator = new GatewayValidator(() => client)
    await validator.validate("http://gw", ["SELECT 1"], signal())
    await validator.validate("http://gw", ["SELECT 2"], signal())
    expect(calls.openSession).toBe(1)
    await validator.dispose()
    expect(calls.closeSession).toBe(1)
  })

  it("an endpoint change closes the old session and opens a fresh one", async () => {
    const { client, calls } = stubGateway()
    const validator = new GatewayValidator(() => client)
    await validator.validate("http://gw-a", ["SELECT 1"], signal())
    await validator.validate("http://gw-b", ["SELECT 1"], signal())
    expect(calls.openSession).toBe(2)
    expect(calls.closeSession).toBe(1)
  })

  it("2.4 an aborted pass resolves as aborted, not as planner errors", async () => {
    const controller = new AbortController()
    const client: GatewayClientLike = {
      openSession: () => Promise.resolve("s"),
      explainInSession: () => {
        controller.abort()
        return Promise.reject(new Error("socket hang up"))
      },
      closeSession: () => Promise.resolve(),
    }
    const validator = new GatewayValidator(() => client)
    const outcome = await validator.validate(
      "http://gw",
      ["SELECT 1"],
      controller.signal,
    )
    expect(outcome).toEqual({ kind: "aborted" })
  })

  it("2.5 an unreachable gateway resolves as unreachable (session open fails)", async () => {
    const client: GatewayClientLike = {
      openSession: () =>
        Promise.reject(new Error("SQL Gateway unreachable at http://gw")),
      explainInSession: () => Promise.resolve(""),
      closeSession: () => Promise.resolve(),
    }
    const validator = new GatewayValidator(() => client)
    const outcome = await validator.validate(
      "http://gw",
      ["SELECT 1"],
      signal(),
    )
    expect(outcome.kind).toBe("unreachable")
  })

  it("an operation timeout resolves as timeout", async () => {
    const client: GatewayClientLike = {
      openSession: () => Promise.resolve("s"),
      explainInSession: () =>
        Promise.reject(
          new Error("Operation op-1 did not complete within 30000ms"),
        ),
      closeSession: () => Promise.resolve(),
    }
    const validator = new GatewayValidator(() => client)
    const outcome = await validator.validate(
      "http://gw",
      ["SELECT 1"],
      signal(),
    )
    expect(outcome.kind).toBe("timeout")
  })
})
