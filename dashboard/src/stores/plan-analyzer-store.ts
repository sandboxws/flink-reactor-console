/**
 * Plan analyzer store — Flink execution plan parsing, visualization, and
 * optimization analysis.
 *
 * Accepts plan text (JSON, text, or job graph format) or SQL input, parses it
 * into a normalized plan structure, and runs multiple analyzer modules
 * (bottleneck, join, skew, state, watermark, window) to produce recommendations.
 *
 * SQL input is handled via the SQL Gateway: DDL/SET statements are submitted
 * first, then EXPLAIN is used to extract the execution plan.
 *
 * @module plan-analyzer-store
 */

import { create } from "zustand"
import {
  closeSQLSession,
  createSQLSession,
  explainStatement,
  fetchSQLResults,
  submitSQLStatement,
} from "@/lib/graphql-api-client"
import { analyzePlan, detectFormat, parsePlan } from "@/lib/plan-analyzer"
import type {
  AnalyzedFlinkPlan,
  FlinkPlanFormat,
  NormalizedFlinkPlan,
} from "@/lib/plan-analyzer/types"

/** Lifecycle status of the plan analysis. */
type AnalysisStatus = "idle" | "analyzing" | "done" | "error"
/** Available tabs in the plan analyzer UI. */
type AnalysisTab = "dag" | "analysis" | "recommendations" | "state"

interface PlanAnalyzerState {
  /** Raw plan text from user input or EXPLAIN output. */
  planText: string
  /** Original SQL source (set when using explainSQL). */
  sourceSQL: string
  /** Detected or user-specified plan format. */
  format: FlinkPlanFormat | null

  /** Parsed normalized plan structure, or null if not yet analyzed. */
  parsedPlan: NormalizedFlinkPlan | null
  /** Full analysis result with annotations and recommendations. */
  analyzedPlan: AnalyzedFlinkPlan | null

  /** Current analysis lifecycle status. */
  status: AnalysisStatus
  /** Error message from the most recent failed analysis. */
  error: string | null
  /** Currently active tab in the plan analyzer UI. */
  activeTab: AnalysisTab
  /** Selected plan node ID in the DAG view. */
  selectedNodeId: string | null
}

interface PlanAnalyzerActions {
  /** Update plan text and auto-detect the format. */
  setPlanText: (text: string) => void
  /** Parse and analyze the plan text (optionally with explicit text and format). */
  analyze: (text?: string, format?: FlinkPlanFormat) => void
  /** Submit SQL to the SQL Gateway, EXPLAIN it, and analyze the resulting plan. */
  explainSQL: (sql: string) => Promise<void>
  /** Switch the active tab in the UI. */
  setActiveTab: (tab: AnalysisTab) => void
  /** Select a plan node in the DAG view. */
  selectNode: (nodeId: string | null) => void
  /** Reset all state to initial defaults. */
  reset: () => void
}

export type PlanAnalyzerStore = PlanAnalyzerState & PlanAnalyzerActions

const INITIAL_STATE: PlanAnalyzerState = {
  planText: "",
  sourceSQL: "",
  format: null,
  parsedPlan: null,
  analyzedPlan: null,
  status: "idle",
  error: null,
  activeTab: "dag",
  selectedNodeId: null,
}

export const usePlanAnalyzerStore = create<PlanAnalyzerStore>((set, get) => ({
  ...INITIAL_STATE,

  setPlanText: (text: string) => {
    const format = text.trim() ? detectFormat(text) : null
    set({ planText: text, format })
  },

  analyze: (text?: string, format?: FlinkPlanFormat) => {
    const input = text ?? get().planText
    if (!input.trim()) {
      set({ error: "No plan text provided", status: "error" })
      return
    }

    set({ status: "analyzing", error: null })

    try {
      const parsedPlan = parsePlan(input, format)
      const analyzedPlan = analyzePlan(parsedPlan)

      set({
        planText: input,
        format: format ?? detectFormat(input),
        parsedPlan,
        analyzedPlan,
        status: "done",
        error: null,
      })
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Failed to analyze plan",
        parsedPlan: null,
        analyzedPlan: null,
      })
    }
  },

  explainSQL: async (sql: string) => {
    if (!sql.trim()) {
      set({ error: "No SQL to explain", status: "error" })
      return
    }

    set({ status: "analyzing", error: null })

    let sessionHandle: string | null = null
    try {
      sessionHandle = await createSQLSession()

      // Split into individual statements, stripping interleaved comment lines
      const stripComments = (s: string) =>
        s
          .split("\n")
          .filter((line) => !line.trimStart().startsWith("--"))
          .join("\n")
          .trim()
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => stripComments(s))
        .filter(Boolean)

      // Submit DDL/SET statements first so tables exist in the session
      for (const stmt of statements) {
        const upper = stmt.toUpperCase()
        if (upper.startsWith("CREATE ") || upper.startsWith("SET ")) {
          const opHandle = await submitSQLStatement(sessionHandle, stmt)
          // Wait for DDL to complete — errors here mean tables won't exist
          // for the subsequent EXPLAIN, so we let them propagate
          await fetchSQLResults(sessionHandle, opHandle)
        }
      }

      // Find the main DML statement to EXPLAIN
      const mainStmt = statements.findLast((s) => {
        const upper = s.toUpperCase()
        return !upper.startsWith("CREATE ") && !upper.startsWith("SET ")
      })
      if (!mainStmt) {
        throw new Error("No DML statement found to explain")
      }

      const result = await explainStatement(sessionHandle, mainStmt)
      const format = (result.format as FlinkPlanFormat) || undefined
      const parsedPlan = parsePlan(result.planText, format)
      const analyzedPlan = analyzePlan(parsedPlan)

      set({
        planText: result.planText,
        sourceSQL: sql,
        format: format ?? detectFormat(result.planText),
        parsedPlan,
        analyzedPlan,
        status: "done",
        error: null,
      })
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : "Failed to explain SQL",
        parsedPlan: null,
        analyzedPlan: null,
      })
    } finally {
      if (sessionHandle) {
        closeSQLSession(sessionHandle).catch(() => {})
      }
    }
  },

  setActiveTab: (tab: AnalysisTab) => {
    set({ activeTab: tab })
  },

  selectNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId })
  },

  reset: () => {
    set(INITIAL_STATE)
  },
}))
