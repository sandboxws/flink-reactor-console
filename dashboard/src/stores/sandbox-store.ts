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
import {
  findTemplate,
  DEFAULT_TEMPLATE_ID,
  type TemplateId,
} from "@/components/sandbox/templates"

// ---------------------------------------------------------------------------
// Sandbox store — editor state, synthesis status, output tabs
// ---------------------------------------------------------------------------

export type SynthStatus = "idle" | "synthesizing" | "done" | "error"

export type { SynthesisResult }

export interface ValidationDiagnostic {
  severity: "error" | "warning"
  message: string
  componentName?: string
  nodeId?: string
  category?: "schema" | "expression" | "connector" | "changelog" | "structure" | "sql"
  details?: {
    readonly availableColumns?: readonly string[]
    readonly referencedColumn?: string
    readonly expressionErrors?: readonly string[]
    readonly missingProps?: readonly string[]
  }
}

// ---------------------------------------------------------------------------
// localStorage persistence keys
// ---------------------------------------------------------------------------

const LS_CODE_KEY = "fr-sandbox-code"
const LS_TEMPLATE_KEY = "fr-sandbox-template"

function loadPersistedState(): { code: string; templateId: TemplateId | null } {
  try {
    const code = localStorage.getItem(LS_CODE_KEY)
    const templateId = localStorage.getItem(LS_TEMPLATE_KEY) as TemplateId | null
    if (code !== null) {
      return { code, templateId }
    }
  } catch {
    // localStorage unavailable (SSR, privacy mode)
  }
  // First visit — load default template
  const defaultTpl = findTemplate(DEFAULT_TEMPLATE_ID)
  return { code: defaultTpl?.code ?? "", templateId: DEFAULT_TEMPLATE_ID }
}

function persistCode(code: string) {
  try {
    localStorage.setItem(LS_CODE_KEY, code)
  } catch {
    // ignore
  }
}

function persistTemplate(id: TemplateId | null) {
  try {
    if (id) {
      localStorage.setItem(LS_TEMPLATE_KEY, id)
    } else {
      localStorage.removeItem(LS_TEMPLATE_KEY)
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface SandboxState {
  code: string
  activeExample: string | null
  activeTemplate: TemplateId | null
  status: SynthStatus
  pipelines: PipelineOutput[]
  diagnostics: ValidationDiagnostic[]
  synthError: string | null
  synthErrorKind: "transpile" | "synthesis" | "unexpected" | null
  synthErrorLine: number | undefined
  synthErrorColumn: number | undefined
  synthTimeMs: number | null
  activeOutputTab: "sql" | "crd" | "explain"
  dslLoading: boolean
}

interface SandboxActions {
  setCode: (code: string) => void
  loadExample: (id: string) => void
  setTemplate: (id: TemplateId) => void
  setActiveOutputTab: (tab: "sql" | "crd" | "explain") => void
  synthesize: () => Promise<void>
}

export type SandboxStore = SandboxState & SandboxActions

// Load persisted or default state
const persisted = loadPersistedState()

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  code: persisted.code,
  activeExample: null,
  activeTemplate: persisted.templateId,
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

  setCode: (code: string) => {
    set({ code })
    persistCode(code)
  },

  loadExample: (id: string) => {
    const example = findExample(id)
    if (!example) return
    set({
      code: example.code,
      activeExample: id,
      activeTemplate: null,
      status: "idle",
      pipelines: [],
      diagnostics: [],
      synthError: null,
      synthErrorKind: null,
      synthTimeMs: null,
    })
    persistCode(example.code)
    persistTemplate(null)
    // Auto-synthesize after loading
    setTimeout(() => get().synthesize(), 0)
  },

  setTemplate: (id: TemplateId) => {
    const tpl = findTemplate(id)
    if (!tpl) return
    set({
      code: tpl.code,
      activeTemplate: id,
      activeExample: null,
      status: "idle",
      pipelines: [],
      diagnostics: [],
      synthError: null,
      synthErrorKind: null,
      synthTimeMs: null,
    })
    persistCode(tpl.code)
    persistTemplate(id)
    // Auto-synthesize after loading
    setTimeout(() => get().synthesize(), 0)
  },

  setActiveOutputTab: (tab: "sql" | "crd" | "explain") => set({ activeOutputTab: tab }),

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
