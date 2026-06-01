import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the SQL Gateway client used by the store. splitStatements (pure) stays real.
vi.mock("@/lib/graphql-api-client", () => ({
  cancelJob: vi.fn(async () => {}),
  createSQLSession: vi.fn(async () => "sess-1"),
  submitSQLStatement: vi.fn(async () => "op-1"),
  fetchSQLResults: vi.fn(),
}))

import {
  cancelJob,
  createSQLSession,
  fetchSQLResults,
  submitSQLStatement,
} from "@/lib/graphql-api-client"
import { useCatalogExploreStore } from "./catalog-explore-store"

const fetchResults = vi.mocked(fetchSQLResults)
const createSession = vi.mocked(createSQLSession)
const submit = vi.mocked(submitSQLStatement)
const cancel = vi.mocked(cancelJob)

function batch(
  columns: { name: string; dataType: string }[],
  rows: (string | null)[][],
  jobID: string | null,
) {
  return { columns, rows, hasMore: false, nextToken: null, jobID }
}

beforeEach(() => {
  vi.clearAllMocks()
  createSession.mockResolvedValue("sess-1")
  submit.mockResolvedValue("op-1")
  cancel.mockResolvedValue(undefined)
  useCatalogExploreStore.setState({
    runtimeMode: "STREAMING",
    maxRows: 10_000,
    stateTtl: "off",
    sessionHandle: null,
    activeJobId: null,
    sql: "",
    status: "idle",
    columns: [],
    rows: [],
    streaming: false,
    error: null,
    cancelled: false,
    statements: [],
    activeIndex: 0,
  })
})

describe("executeAll", () => {
  it("runs each statement sequentially with per-statement results, jobId, and timing", async () => {
    fetchResults
      .mockResolvedValueOnce(
        batch([{ name: "result", dataType: "STRING" }], [["OK"]], null),
      )
      .mockResolvedValueOnce(
        batch([{ name: "id", dataType: "BIGINT" }], [["1"], ["2"]], "job-abc"),
      )

    useCatalogExploreStore
      .getState()
      .setSql("CREATE TABLE t (id BIGINT);\nSELECT * FROM t;")
    await useCatalogExploreStore.getState().executeAll()

    const s = useCatalogExploreStore.getState()
    expect(s.status).toBe("completed")
    expect(s.statements).toHaveLength(2)
    expect(s.statements.map((x) => x.status)).toEqual([
      "completed",
      "completed",
    ])
    // job id captured only for the statement that launched a job
    expect(s.statements[0].jobId).toBeNull()
    expect(s.statements[1].jobId).toBe("job-abc")
    expect(s.statements[1].rowCount).toBe(2)
    expect(s.statements[0].durationMs).not.toBeNull()
    // session created once and reused across statements
    expect(createSession).toHaveBeenCalledTimes(1)
    // backward-compat: flat fields mirror the active (last) statement
    expect(s.rows).toEqual([["1"], ["2"]])
  })

  it("halts the run on the first failing statement", async () => {
    fetchResults.mockRejectedValueOnce(new Error("syntax error near 'bad'"))

    useCatalogExploreStore.getState().setSql("SELECT bad;\nSELECT 2;")
    await useCatalogExploreStore.getState().executeAll()

    const s = useCatalogExploreStore.getState()
    expect(s.status).toBe("failed")
    expect(s.statements[0].status).toBe("failed")
    expect(s.statements[0].error).toContain("syntax error")
    // the second statement never ran
    expect(s.statements[1].status).toBe("idle")
  })
})

describe("executeSelection", () => {
  it("runs only the provided text, not the whole document", async () => {
    fetchResults.mockResolvedValueOnce(batch([], [], null))

    useCatalogExploreStore.getState().setSql("SELECT 1;\nSELECT 2;\nSELECT 3;")
    await useCatalogExploreStore.getState().executeSelection("SELECT 2")

    const s = useCatalogExploreStore.getState()
    expect(s.statements).toHaveLength(1)
    expect(s.statements[0].sql).toBe("SELECT 2")
    expect(s.statements[0].status).toBe("completed")
  })
})

describe("setActiveStatement", () => {
  it("surfaces the chosen statement's result through the flat fields", async () => {
    fetchResults
      .mockResolvedValueOnce(
        batch([{ name: "a", dataType: "INT" }], [["1"]], null),
      )
      .mockResolvedValueOnce(
        batch([{ name: "b", dataType: "INT" }], [["2"]], null),
      )

    useCatalogExploreStore.getState().setSql("SELECT 1;\nSELECT 2;")
    await useCatalogExploreStore.getState().executeAll()

    useCatalogExploreStore.getState().setActiveStatement(0)
    const s = useCatalogExploreStore.getState()
    expect(s.activeIndex).toBe(0)
    expect(s.rows).toEqual([["1"]])
  })
})

describe("runtime mode", () => {
  it("pins STREAMING on the session by default before running", async () => {
    fetchResults.mockResolvedValue(batch([], [], null))

    useCatalogExploreStore.getState().setSql("SELECT 1;")
    await useCatalogExploreStore.getState().executeAll()

    expect(submit).toHaveBeenCalledWith(
      "sess-1",
      "SET 'execution.runtime-mode' = 'STREAMING'",
    )
  })

  it("pins the selected mode when switched to BATCH", async () => {
    fetchResults.mockResolvedValue(batch([], [], null))

    useCatalogExploreStore.getState().setRuntimeMode("BATCH")
    useCatalogExploreStore.getState().setSql("SELECT 1;")
    await useCatalogExploreStore.getState().executeAll()

    expect(submit).toHaveBeenCalledWith(
      "sess-1",
      "SET 'execution.runtime-mode' = 'BATCH'",
    )
  })
})

describe("result cap & state TTL", () => {
  it("caps accumulated rows at maxRows", async () => {
    useCatalogExploreStore.setState({ maxRows: 2 })
    fetchResults.mockResolvedValue({
      columns: [{ name: "n", dataType: "INT" }],
      rows: [["1"], ["2"], ["3"], ["4"], ["5"]],
      hasMore: false,
      nextToken: null,
      jobID: null,
    })

    useCatalogExploreStore.getState().setSql("SELECT 1;")
    await useCatalogExploreStore.getState().executeAll()

    expect(useCatalogExploreStore.getState().statements[0].rowCount).toBe(2)
  })

  it("cancels a still-producing job when truncated at the cap", async () => {
    useCatalogExploreStore.setState({ maxRows: 2 })
    fetchResults.mockResolvedValue({
      columns: [{ name: "n", dataType: "INT" }],
      rows: [["1"], ["2"], ["3"]],
      hasMore: true, // source still has more → job is still running
      nextToken: "1",
      jobID: "job-stream",
    })

    useCatalogExploreStore.getState().setSql("SELECT * FROM s;")
    await useCatalogExploreStore.getState().executeAll()

    expect(useCatalogExploreStore.getState().statements[0].rowCount).toBe(2)
    expect(cancel).toHaveBeenCalledWith("job-stream")
  })

  it("does not cancel when the source ends naturally at the cap", async () => {
    useCatalogExploreStore.setState({ maxRows: 2 })
    fetchResults.mockResolvedValue({
      columns: [{ name: "n", dataType: "INT" }],
      rows: [["1"], ["2"]],
      hasMore: false, // EOS — job finished on its own
      nextToken: null,
      jobID: "job-bounded",
    })

    useCatalogExploreStore.getState().setSql("SELECT * FROM s;")
    await useCatalogExploreStore.getState().executeAll()

    expect(cancel).not.toHaveBeenCalled()
  })

  it("does not set state TTL when off (default)", async () => {
    fetchResults.mockResolvedValue(batch([], [], null))

    useCatalogExploreStore.getState().setSql("SELECT 1;")
    await useCatalogExploreStore.getState().executeAll()

    expect(submit).not.toHaveBeenCalledWith(
      "sess-1",
      expect.stringContaining("table.exec.state.ttl"),
    )
  })

  it("sets state TTL when enabled", async () => {
    fetchResults.mockResolvedValue(batch([], [], null))

    useCatalogExploreStore.getState().setStateTtl("1 h")
    useCatalogExploreStore.getState().setSql("SELECT 1;")
    await useCatalogExploreStore.getState().executeAll()

    expect(submit).toHaveBeenCalledWith(
      "sess-1",
      "SET 'table.exec.state.ttl' = '1 h'",
    )
  })
})

describe("cancellation", () => {
  it("cancels the active Flink job and halts the client loop", () => {
    useCatalogExploreStore.setState({
      activeJobId: "job-xyz",
      status: "running",
    })

    useCatalogExploreStore.getState().cancelQuery()

    expect(cancel).toHaveBeenCalledWith("job-xyz")
    expect(useCatalogExploreStore.getState().status).toBe("cancelled")
    expect(useCatalogExploreStore.getState().cancelled).toBe(true)
  })

  it("skips cancelJob when no job is in flight (DDL / bounded statement)", () => {
    useCatalogExploreStore.setState({ activeJobId: null, status: "running" })

    useCatalogExploreStore.getState().cancelQuery()

    expect(cancel).not.toHaveBeenCalled()
    expect(useCatalogExploreStore.getState().status).toBe("cancelled")
  })
})

describe("live streaming + parity", () => {
  it("streams rows into the store as pages arrive (not only at the end)", async () => {
    fetchResults
      .mockResolvedValueOnce({
        columns: [{ name: "n", dataType: "INT" }],
        rows: [["1"]],
        hasMore: true,
        nextToken: "1",
        jobID: "job-1",
      })
      .mockResolvedValueOnce({
        columns: [],
        rows: [["2"]],
        hasMore: false,
        nextToken: null,
        jobID: null,
      })

    const seenRowCounts: number[] = []
    const unsub = useCatalogExploreStore.subscribe((s) =>
      seenRowCounts.push(s.rows.length),
    )

    useCatalogExploreStore.getState().setSql("SELECT * FROM t;")
    await useCatalogExploreStore.getState().executeAll()
    unsub()

    // The first page (1 row) was surfaced before the final two — live updates.
    expect(seenRowCounts).toContain(1)
    expect(useCatalogExploreStore.getState().rows).toEqual([["1"], ["2"]])
  })

  it("executeQuery shares the run loop with the console (live + runtime-mode parity)", async () => {
    fetchResults.mockResolvedValueOnce({
      columns: [{ name: "n", dataType: "INT" }],
      rows: [["1"], ["2"]],
      hasMore: false,
      nextToken: null,
      jobID: "job-q",
    })

    useCatalogExploreStore.getState().setSql("SELECT * FROM t")
    await useCatalogExploreStore.getState().executeQuery()

    const s = useCatalogExploreStore.getState()
    expect(s.status).toBe("completed")
    expect(s.rows).toEqual([["1"], ["2"]])
    expect(s.columns).toEqual([{ name: "n", dataType: "INT" }])
    // identical session-config path as runStatements
    expect(submit).toHaveBeenCalledWith(
      "sess-1",
      "SET 'execution.runtime-mode' = 'STREAMING'",
    )
  })
})
