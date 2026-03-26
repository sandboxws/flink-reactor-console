import { create } from "zustand"
import {
  DEFAULT_EXAMPLE_ID,
  findExample,
} from "@/components/sandbox/sandbox-examples"
import {
  DEFAULT_TEMPLATE_ID,
  findTemplate,
  type TemplateId,
} from "@/components/sandbox/templates"
import {
  isDslLoaded,
  type PipelineOutput,
  synthesize as runSynthesis,
  type SynthesisResult,
} from "@/lib/sandbox-synthesizer"

/**
 * Sandbox store — DSL editor state, synthesis execution, and output tabs.
 *
 * Manages the FlinkReactor DSL code editor with template/example switching,
 * runs client-side synthesis (transpile DSL → SQL + CRD), and stores the
 * output pipelines and validation diagnostics. Editor content and active
 * template are persisted to localStorage.
 *
 * @module sandbox-store
 */

/** Lifecycle status of the DSL synthesis process. */
export type SynthStatus = "idle" | "synthesizing" | "done" | "error"

export type { SynthesisResult }

/** A diagnostic produced during DSL validation (pre-synthesis). */
export interface ValidationDiagnostic {
  /** Diagnostic severity. */
  severity: "error" | "warning"
  /** Human-readable diagnostic message. */
  message: string
  /** Name of the DSL component that produced this diagnostic. */
  componentName?: string
  /** Node ID in the pipeline graph, if applicable. */
  nodeId?: string
  /** Diagnostic category for grouping/filtering. */
  category?:
    | "schema"
    | "expression"
    | "connector"
    | "changelog"
    | "structure"
    | "sql"
  /** Structured detail for IDE-like suggestions. */
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
    const templateId = localStorage.getItem(
      LS_TEMPLATE_KEY,
    ) as TemplateId | null
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
  /** Current DSL source code in the editor. */
  code: string
  /** ID of the currently loaded example, or null. */
  activeExample: string | null
  /** ID of the currently loaded template, or null. */
  activeTemplate: TemplateId | null
  /** Current synthesis lifecycle status. */
  status: SynthStatus
  /** Output pipelines from the last successful synthesis. */
  pipelines: PipelineOutput[]
  /** Validation diagnostics from the last synthesis. */
  diagnostics: ValidationDiagnostic[]
  /** Error message from the last failed synthesis. */
  synthError: string | null
  /** Category of the synthesis error (transpile, synthesis, or unexpected). */
  synthErrorKind: "transpile" | "synthesis" | "unexpected" | null
  /** Line number of the synthesis error, if available. */
  synthErrorLine: number | undefined
  /** Column number of the synthesis error, if available. */
  synthErrorColumn: number | undefined
  /** Time taken for the last synthesis in milliseconds. */
  synthTimeMs: number | null
  /** Currently active output tab (SQL, CRD, or Explain). */
  activeOutputTab: "sql" | "crd" | "explain"
  /** True during the first synthesis when the DSL WASM module is loading. */
  dslLoading: boolean
}

interface SandboxActions {
  /** Update the editor code and persist to localStorage. */
  setCode: (code: string) => void
  /** Load a built-in example by ID and auto-synthesize. */
  loadExample: (id: string) => void
  /** Load a template by ID and auto-synthesize. */
  setTemplate: (id: TemplateId) => void
  /** Switch the active output tab. */
  setActiveOutputTab: (tab: "sql" | "crd" | "explain") => void
  /** Run DSL synthesis on the current editor code. */
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

  setActiveOutputTab: (tab: "sql" | "crd" | "explain") =>
    set({ activeOutputTab: tab }),

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
