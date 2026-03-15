import { create } from "zustand"
import type { AppSynthResult } from "flink-reactor/browser"
import {
  synthesize as runSynthesis,
  isDslLoaded,
  type SynthesisResult,
} from "@/lib/sandbox-synthesizer"

// ---------------------------------------------------------------------------
// Sandbox store — editor state, synthesis status, output tabs
// ---------------------------------------------------------------------------

export type TemplateId = "blank" | "hello-world" | "kafka-filter" | "windowed-aggregate"

export type SynthStatus = "idle" | "synthesizing" | "done" | "error"

export type { SynthesisResult }

export interface ValidationDiagnostic {
  severity: "error" | "warning"
  message: string
  componentName?: string
}

interface SandboxState {
  code: string
  activeTemplate: TemplateId
  status: SynthStatus
  result: AppSynthResult | null
  diagnostics: ValidationDiagnostic[]
  synthError: string | null
  synthErrorKind: "transpile" | "synthesis" | "unexpected" | null
  synthErrorLine: number | undefined
  synthErrorColumn: number | undefined
  synthTimeMs: number | null
  activeOutputTab: "sql" | "crd"
  dslLoading: boolean
}

interface SandboxActions {
  setCode: (code: string) => void
  setTemplate: (template: TemplateId) => void
  setActiveOutputTab: (tab: "sql" | "crd") => void
  synthesize: () => Promise<void>
}

export type SandboxStore = SandboxState & SandboxActions

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  code: "",
  activeTemplate: "blank",
  status: "idle",
  result: null,
  diagnostics: [],
  synthError: null,
  synthErrorKind: null,
  synthErrorLine: undefined,
  synthErrorColumn: undefined,
  synthTimeMs: null,
  activeOutputTab: "sql",
  dslLoading: false,

  setCode: (code: string) => set({ code }),

  setTemplate: (template: TemplateId) => set({ activeTemplate: template }),

  setActiveOutputTab: (tab: "sql" | "crd") => set({ activeOutputTab: tab }),

  synthesize: async () => {
    const code = get().code
    if (!code.trim()) {
      set({ status: "idle", result: null, diagnostics: [], synthError: null })
      return
    }

    const isFirstLoad = !isDslLoaded()
    set({
      status: "synthesizing",
      dslLoading: isFirstLoad,
      synthError: null,
      synthErrorKind: null,
      synthErrorLine: undefined,
      synthErrorColumn: undefined,
      diagnostics: [],
    })

    const res = await runSynthesis(code)

    if (res.ok) {
      set({
        status: "done",
        dslLoading: false,
        result: res.result,
        diagnostics: res.diagnostics,
        synthTimeMs: res.timeMs,
        synthError: null,
        synthErrorKind: null,
      })
    } else {
      set({
        status: "error",
        dslLoading: false,
        result: null,
        synthError: res.error,
        synthErrorKind: res.errorKind,
        synthErrorLine: res.line,
        synthErrorColumn: res.column,
        synthTimeMs: null,
      })
    }
  },
}))
