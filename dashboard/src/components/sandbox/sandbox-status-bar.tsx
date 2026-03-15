import { useSandboxStore } from "@/stores/sandbox-store"

export function SandboxStatusBar() {
  const status = useSandboxStore((s) => s.status)
  const synthTimeMs = useSandboxStore((s) => s.synthTimeMs)
  const diagnostics = useSandboxStore((s) => s.diagnostics)

  const errorCount = diagnostics.filter((d) => d.severity === "error").length
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length

  const statusText = () => {
    switch (status) {
      case "idle":
        return "Idle"
      case "synthesizing":
        return "Synthesizing..."
      case "done":
        return `Done (${synthTimeMs}ms)`
      case "error":
        return "Error"
    }
  }

  return (
    <div className="glass-card flex items-center gap-4 rounded-lg px-4 py-2 text-xs">
      <span
        className={status === "error" ? "text-job-failed" : "text-zinc-400"}
      >
        {statusText()}
      </span>

      {(errorCount > 0 || warningCount > 0) && (
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="text-job-failed">
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-fr-amber">
              {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
