import { create } from "zustand"

// ---------------------------------------------------------------------------
// Sandbox store — editor state, synthesis status, output tabs
// ---------------------------------------------------------------------------

export type TemplateId = "blank" | "hello-world" | "kafka-filter" | "windowed-aggregate"

export type SynthStatus = "idle" | "synthesizing" | "done" | "error"

export interface ValidationDiagnostic {
  severity: "error" | "warning"
  message: string
  line?: number
  column?: number
}

export interface AppSynthResult {
  sql: string[]
  crd: string
}

interface SandboxState {
  code: string
  activeTemplate: TemplateId
  status: SynthStatus
  result: AppSynthResult | null
  diagnostics: ValidationDiagnostic[]
  synthError: string | null
  synthTimeMs: number | null
  activeOutputTab: "sql" | "crd"
}

interface SandboxActions {
  setCode: (code: string) => void
  setTemplate: (template: TemplateId) => void
  setActiveOutputTab: (tab: "sql" | "crd") => void
  synthesize: () => Promise<void>
}

export type SandboxStore = SandboxState & SandboxActions

export const useSandboxStore = create<SandboxStore>((set) => ({
  code: "",
  activeTemplate: "blank",
  status: "idle",
  result: null,
  diagnostics: [],
  synthError: null,
  synthTimeMs: null,
  activeOutputTab: "sql",

  setCode: (code: string) => set({ code }),

  setTemplate: (template: TemplateId) => set({ activeTemplate: template }),

  setActiveOutputTab: (tab: "sql" | "crd") => set({ activeOutputTab: tab }),

  // Placeholder — will be wired to actual synthesis in Change 3
  synthesize: async () => {
    set({ status: "synthesizing", synthError: null, diagnostics: [] })
    // TODO: Wire to flink-reactor browser synthesis (Change 3)
    set({ status: "idle" })
  },
}))
