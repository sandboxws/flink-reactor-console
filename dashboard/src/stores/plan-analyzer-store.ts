import { create } from "zustand"
import { analyzePlan, detectFormat, parsePlan } from "@/lib/plan-analyzer"
import type {
  AnalyzedFlinkPlan,
  FlinkPlanFormat,
  NormalizedFlinkPlan,
} from "@/lib/plan-analyzer/types"
import {
  createSQLSession,
  explainStatement,
  submitSQLStatement,
  fetchSQLResults,
  closeSQLSession,
} from "@/lib/graphql-api-client"

type AnalysisStatus = "idle" | "analyzing" | "done" | "error"
type AnalysisTab = "dag" | "analysis" | "recommendations" | "state"

interface PlanAnalyzerState {
  // Input
  planText: string
  sourceSQL: string
  format: FlinkPlanFormat | null

  // Results
  parsedPlan: NormalizedFlinkPlan | null
  analyzedPlan: AnalyzedFlinkPlan | null

  // UI state
  status: AnalysisStatus
  error: string | null
  activeTab: AnalysisTab
  selectedNodeId: string | null
}

interface PlanAnalyzerActions {
  setPlanText: (text: string) => void
  analyze: (text?: string, format?: FlinkPlanFormat) => void
  explainSQL: (sql: string) => Promise<void>
  setActiveTab: (tab: AnalysisTab) => void
  selectNode: (nodeId: string | null) => void
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
