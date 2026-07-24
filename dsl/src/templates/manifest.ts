// ── Template manifest: a serialisable projection of the DSL registry ─────────
//
// The scaffolder registry (`TEMPLATE_FACTORIES` et al. in `cli/commands/new.ts`)
// is the single source of truth for FlinkReactor's project templates. Nothing
// there is queryable by the Console. This module *projects* that registry into a
// stable, serialisable `TemplateManifest[]` — the contract every downstream
// surface reads from (the GraphQL registry in `flows-02`, the Hub gallery in
// `flows-03`).
//
// Every field is derived from the registry; no template metadata is authored a
// second time here. A drift test (`__tests__/manifest.test.ts`) fails if the
// manifest and `TEMPLATE_FACTORIES` ever diverge in count or names — the G1
// "drift is a hard failure" contract.

import {
  type ScaffoldOptions,
  TEMPLATE_DESCRIPTIONS,
  TEMPLATE_FACTORIES,
  type TemplateFile,
  type TemplateName,
} from "@/cli/commands/new.js"
import { EXPECTED_PIPELINES } from "@/cli/templates/expected-pipelines.js"

/**
 * The gallery grouping a template belongs to. Kept small and closed so the Hub
 * can offer a stable category filter; projected onto the GraphQL
 * `TemplateCategory` enum in `flows-02`.
 */
export type TemplateCategory =
  | "lakehouse"
  | "cdc"
  | "analytics"
  | "showcase"
  | "starter"

/**
 * One scaffold-form input. v0.1 surfaces `ScaffoldOptions` as-is (loosely
 * typed) — rich per-template parameter schemas are a later opt-in (a Non-Goal
 * of flows-01/flows-02).
 */
export interface TemplateParam {
  name: string
  type: "string" | "boolean" | "enum"
  required: boolean
  default?: string
  options?: string[]
  description?: string
}

/** The projected, serialisable shape of one registered template. */
export interface TemplateManifest {
  name: TemplateName
  category: TemplateCategory
  description: string
  pipelines: string[]
  requiredServices: string[]
  params: TemplateParam[]
}

// ── Category derivation ──────────────────────────────────────────────────────
// Derived from the template set, not a new hand-maintained per-template map
// (which would reintroduce exactly the drift this module exists to remove).
// `starter`/`cdc`/`analytics`/`lakehouse` membership is small and explicit;
// everything else is a business-domain "showcase". The two genuinely ambiguous
// templates are placed deliberately (a product decision, not an accident):
//   • data-quality    → analytics   (a record-normalisation / DQ technique demo)
//   • pg-fluss-paimon → lakehouse   (shared streaming storage → OLAP fan-out)

const STARTER_TEMPLATES = new Set<TemplateName>([
  "starter",
  "minimal",
  "monorepo",
])
const LAKEHOUSE_TEMPLATES = new Set<TemplateName>([
  "lakehouse-ingestion",
  "lakehouse-analytics",
  "pg-fluss-paimon",
])
const ANALYTICS_TEMPLATES = new Set<TemplateName>([
  "realtime-analytics",
  "data-quality",
])

export function deriveCategory(name: TemplateName): TemplateCategory {
  if (STARTER_TEMPLATES.has(name)) return "starter"
  // `cdc-lakehouse` leads with CDC even though it also touches the lakehouse.
  if (name.includes("cdc")) return "cdc"
  if (LAKEHOUSE_TEMPLATES.has(name)) return "lakehouse"
  if (ANALYTICS_TEMPLATES.has(name)) return "analytics"
  return "showcase"
}

// ── Scaffold-form params ─────────────────────────────────────────────────────
// A single description of the `flink-reactor new` form — uniform across
// templates (v0.1). Mirrors the choices/defaults in `cli/commands/new.ts`.
// `template` is the selector itself and `registry` is an install-time concern,
// so neither is surfaced as an authoring parameter.

function scaffoldParams(): TemplateParam[] {
  return [
    {
      name: "projectName",
      type: "string",
      required: true,
      description: "Target project directory name",
    },
    {
      name: "pm",
      type: "enum",
      required: false,
      default: "pnpm",
      options: ["pnpm", "npm", "yarn"],
      description: "Package manager",
    },
    {
      name: "flinkVersion",
      type: "enum",
      required: false,
      default: "2.3",
      options: ["1.20", "2.0", "2.1", "2.2", "2.3"],
      description: "Target Flink version",
    },
    {
      name: "gitInit",
      type: "boolean",
      required: false,
      default: "true",
      description: "Initialize a git repository",
    },
    {
      name: "installDeps",
      type: "boolean",
      required: false,
      default: "true",
      description: "Install dependencies after scaffolding",
    },
    {
      name: "grafanaEnabled",
      type: "boolean",
      required: false,
      default: "false",
      description:
        "Enable the bundled Prometheus + Grafana stack (Flink 2.x only)",
    },
  ]
}

// ── requiredServices extraction ──────────────────────────────────────────────
// Read straight from each template's *rendered* `flink-reactor.config.ts`
// `services: { ... }` block — the real, single source of truth for what a
// template depends on. We collect the top-level service keys (kafka, postgres,
// iceberg, fluss, …) and ignore nested option keys.
//
// The `services:` match is anchored to the start of a line so it binds to the
// actual `defineConfig` property, never the `\`services: { kafka: {} }\`` example
// in the shared config's guidance comment. Callers pass the *effective* config
// (see `effectiveConfig`) so templates that override the shared default win.

function extractRequiredServices(configContent: string): string[] {
  const open = /(^|\n)[ \t]*services\s*:\s*\{/.exec(configContent)
  if (!open) return []

  const bodyStart = open.index + open[0].length
  const services: string[] = []
  let depth = 1 // we start just inside the `services: {` brace
  let token = ""

  for (let i = bodyStart; i < configContent.length && depth > 0; i++) {
    const ch = configContent[i]
    if (ch === "{") {
      depth++
      token = ""
    } else if (ch === "}") {
      depth--
      token = ""
    } else if (ch === ":" && depth === 1) {
      const key = token.trim().replace(/['"]/g, "")
      if (key) services.push(key)
      token = ""
    } else if (ch === "," && depth === 1) {
      token = ""
    } else {
      token += ch
    }
  }

  return services
}

/**
 * Canonical scaffold options used to render a template for projection. Values
 * match the non-interactive defaults of `flink-reactor new` so the manifest
 * (and the emitted sources artifact) mirror what a user gets from the CLI.
 * `grafanaEnabled` stays off so `requiredServices` reflects the base data
 * dependencies, not the optional metrics stack.
 */
function canonicalScaffoldOptions(name: TemplateName): ScaffoldOptions {
  return {
    projectName: name,
    template: name,
    pm: "pnpm",
    flinkVersion: "2.3",
    gitInit: false,
    installDeps: false,
    grafanaEnabled: false,
  }
}

// The effective root config — the *last* `flink-reactor.config.ts` written wins,
// mirroring `scaffoldProject`'s on-disk write order (templates spread the shared
// default first, then push their own populated config).
function effectiveConfig(files: TemplateFile[]): string {
  const configs = files.filter((f) => f.path === "flink-reactor.config.ts")
  return configs.at(-1)?.content ?? ""
}

// Deduplicate files by path, keeping each path's *last* occurrence — matching
// `scaffoldProject`, which writes the array to disk in order so a repeated path
// (a shared default the template later overrides) collapses to one file. Without
// this, an instantiation would carry two `flink-reactor.config.ts` entries and
// diverge from what `flink-reactor new <name>` scaffolds.
function dedupeByPath(files: TemplateFile[]): TemplateFile[] {
  const lastIndex = new Map<string, number>()
  files.forEach((f, i) => {
    lastIndex.set(f.path, i)
  })
  return files.filter((f, i) => lastIndex.get(f.path) === i)
}

// The first `pipelines/<name>/index.tsx` (sorted) — a convenience entry point.
function primaryPipelineTsx(files: TemplateFile[]): string {
  const entries = files
    .filter((f) => /^pipelines\/[^/]+\/index\.tsx$/.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path))
  return entries[0]?.content ?? ""
}

/**
 * Project the scaffolder registry into a serialisable manifest — one entry per
 * `TEMPLATE_FACTORIES` member, in registry order.
 */
export function templateManifest(): TemplateManifest[] {
  const names = Object.keys(TEMPLATE_FACTORIES) as TemplateName[]
  return names.map((name) => {
    const files = TEMPLATE_FACTORIES[name](canonicalScaffoldOptions(name))
    const config = effectiveConfig(files)
    return {
      name,
      category: deriveCategory(name),
      description: TEMPLATE_DESCRIPTIONS[name],
      pipelines: [...EXPECTED_PIPELINES[name]],
      requiredServices: extractRequiredServices(config),
      params: scaffoldParams(),
    }
  })
}

// ── Build artifact ───────────────────────────────────────────────────────────
// The DSL build emits this as `assets/templates.generated.json`. It is a
// superset of the lean manifest: `manifest` is exactly `templateManifest()`
// (so it round-trips), while `sources` carries each template's scaffolded files
// so the server's `instantiateTemplate` (flows-02) can return real source
// without running the Node/DSL toolchain. `count`/`names` are a build stamp the
// server checks for drift.

/** A template's scaffolded output, for the no-Node instantiation path. */
export interface TemplateSource {
  files: TemplateFile[]
  pipelineTsx: string
}

/** The full `templates.generated.json` payload. */
export interface TemplatesArtifact {
  version: number
  count: number
  names: TemplateName[]
  manifest: TemplateManifest[]
  sources: Record<string, TemplateSource>
}

export const TEMPLATES_ARTIFACT_VERSION = 1

export function buildTemplatesArtifact(): TemplatesArtifact {
  const manifest = templateManifest()
  const names = manifest.map((m) => m.name)

  const sources: Record<string, TemplateSource> = {}
  for (const name of names) {
    const files = dedupeByPath(
      TEMPLATE_FACTORIES[name](canonicalScaffoldOptions(name)),
    )
    sources[name] = { files, pipelineTsx: primaryPipelineTsx(files) }
  }

  return {
    version: TEMPLATES_ARTIFACT_VERSION,
    count: manifest.length,
    names,
    manifest,
    sources,
  }
}
