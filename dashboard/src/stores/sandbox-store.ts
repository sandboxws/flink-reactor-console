import { create } from "zustand"
import {
  synthesize as runSynthesis,
  isDslLoaded,
  type SynthesisResult,
  type PipelineOutput,
} from "@/lib/sandbox-synthesizer"
import {
  findExample,
  DEFAULT_EXAMPLE_ID,
} from "@/components/sandbox/sandbox-examples"

// ---------------------------------------------------------------------------
// Sandbox store — editor state, synthesis status, output tabs
// ---------------------------------------------------------------------------

export type SynthStatus = "idle" | "synthesizing" | "done" | "error"

export type { SynthesisResult }

export interface ValidationDiagnostic {
  severity: "error" | "warning"
  message: string
  componentName?: string
}

interface SandboxState {
  code: string
  activeExample: string | null
  status: SynthStatus
  pipelines: PipelineOutput[]
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
  loadExample: (id: string) => void
  setActiveOutputTab: (tab: "sql" | "crd") => void
  synthesize: () => Promise<void>
}

export type SandboxStore = SandboxState & SandboxActions

// Load the default example on init
const defaultExample = findExample(DEFAULT_EXAMPLE_ID)

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  code: defaultExample?.code ?? "",
  activeExample: DEFAULT_EXAMPLE_ID,
  status: "idle",
  pipelines: [],
  diagnostics: [],
  synthError: null,
  synthErrorKind: null,
  synthErrorLine: undefined,
  synthErrorColumn: undefined,
  synthTimeMs: null,
  activeOutputTab: "sql",
  dslLoading: false,

  setCode: (code: string) => set({ code }),

  loadExample: (id: string) => {
    const example = findExample(id)
    if (!example) return
    set({
      code: example.code,
      activeExample: id,
      status: "idle",
      pipelines: [],
      diagnostics: [],
      synthError: null,
      synthErrorKind: null,
      synthTimeMs: null,
    })
    // Auto-synthesize after loading
    setTimeout(() => get().synthesize(), 0)
  },

  setActiveOutputTab: (tab: "sql" | "crd") => set({ activeOutputTab: tab }),

  synthesize: async () => {
    const code = get().code
    if (!code.trim()) {
      set({ status: "idle", pipelines: [], diagnostics: [], synthError: null })
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
        pipelines: res.pipelines,
        diagnostics: res.diagnostics,
        synthTimeMs: res.timeMs,
        synthError: null,
        synthErrorKind: null,
      })
    } else {
      set({
        status: "error",
        dslLoading: false,
        pipelines: [],
        synthError: res.error,
        synthErrorKind: res.errorKind,
        synthErrorLine: res.line,
        synthErrorColumn: res.column,
        synthTimeMs: null,
      })
    }
  },
}))
