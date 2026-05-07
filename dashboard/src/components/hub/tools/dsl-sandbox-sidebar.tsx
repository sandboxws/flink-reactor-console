/**
 * DSL editor LEFT pane — Scratchpads, Templates, Imports lists.
 *
 * Mirrors `console-v2/sandbox.html` lines 80-104. "Scratchpads" today
 * is the loaded example list (sandbox-store doesn't have a saved-file
 * concept yet, but this gives users somewhere to switch templates).
 * "Templates" reuses the existing `TEMPLATES` registry from
 * `components/sandbox/templates.ts`. "Imports" is a static dependency
 * list — the `@flink-reactor/*` packages every DSL pipeline pulls in.
 */

import { Code2, Layers } from "lucide-react"
import { TEMPLATES } from "@/components/sandbox/templates"
import { useSandboxStore } from "@/stores/sandbox-store"

const STATIC_IMPORTS: { name: string; version: string }[] = [
  { name: "@flink-reactor/dsl", version: "^0.4.2" },
  { name: "@flink-reactor/sources", version: "^0.3.1" },
  { name: "@flink-reactor/sinks", version: "^0.3.1" },
  { name: "@flink-reactor/instruments", version: "^0.4.0" },
]

export function DslSandboxSidebar() {
  const activeTemplate = useSandboxStore((s) => s.activeTemplate)
  const setTemplate = useSandboxStore((s) => s.setTemplate)
  const status = useSandboxStore((s) => s.status)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto border-r border-dash-border bg-dash-surface/30 px-3 py-4">
      <h3 className="section-heading mb-2">Scratchpads</h3>
      <ul className="mb-5 space-y-0.5">
        {TEMPLATES.slice(0, 4).map((t) => {
          const isActive = activeTemplate === t.id
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTemplate(t.id)}
                className={`file-tree-row w-full text-left ${isActive ? "active" : ""}`}
              >
                <Code2 className="size-3.5 shrink-0 text-fr-coral" />
                <span className="truncate font-mono text-[12px]">
                  {t.id}.fr.ts
                </span>
                {isActive ? (
                  <span className="ml-auto inline-block size-1.5 shrink-0 rounded-full bg-fr-sage" />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>

      <h3 className="section-heading mb-2">Templates</h3>
      <ul className="mb-5 space-y-0.5">
        {TEMPLATES.map((t) => {
          const isActive = activeTemplate === t.id
          return (
            <li key={`tpl-${t.id}`}>
              <button
                type="button"
                onClick={() => setTemplate(t.id)}
                disabled={status === "synthesizing"}
                className={`file-tree-row w-full text-left ${isActive ? "active" : ""}`}
                title={t.description}
              >
                <Layers className="size-3.5 shrink-0 text-fr-amber" />
                <span className="truncate font-mono text-[12px]">{t.name}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <h3 className="section-heading mb-2">Imports</h3>
      <ul className="space-y-1 font-mono text-[11px]">
        {STATIC_IMPORTS.map((dep) => (
          <li
            key={dep.name}
            className="flex items-center justify-between rounded px-2 py-1 hover:bg-dash-elevated/30"
          >
            <span className="truncate text-fg-muted">{dep.name}</span>
            <span className="text-fg-faint shrink-0">{dep.version}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
