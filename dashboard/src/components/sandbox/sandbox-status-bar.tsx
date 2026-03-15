import { useSandboxStore } from "@/stores/sandbox-store"
import { findExample } from "./sandbox-examples"

export function SandboxStatusBar() {
  const status = useSandboxStore((s) => s.status)
  const synthTimeMs = useSandboxStore((s) => s.synthTimeMs)
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const activeExample = useSandboxStore((s) => s.activeExample)

  const example = activeExample ? findExample(activeExample) : null
  const errorCount = diagnostics.filter((d) => d.severity === "error").length
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length

  const statusText = () => {
    switch (status) {
      case "idle":
        return "Ready"
      case "synthesizing":
        return "Synthesizing..."
      case "done":
        return `Synthesized in ${synthTimeMs}ms`
      case "error":
        return "Error"
    }
  }

  return (
    <div className="flex items-center gap-4 border-t border-dash-border px-4 py-1.5 text-[11px]">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`size-1.5 rounded-full ${
            status === "error"
              ? "bg-red-400"
              : status === "done"
                ? "bg-emerald-400"
                : status === "synthesizing"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-zinc-600"
          }`}
        />
        <span
          className={
            status === "error" ? "text-red-400" : "text-zinc-500"
          }
        >
          {statusText()}
        </span>
      </div>

      {/* Diagnostics */}
      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-red-400">
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-amber-400">
              {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active example name */}
      {example && (
        <span className="text-zinc-600">
          {example.name}
        </span>
      )}
    </div>
  )
}
