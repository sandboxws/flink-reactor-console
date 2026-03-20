import { useEffect, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  PreflightCheckResult,
  SimulationInputParams,
  SimulationPreset,
} from "@/lib/graphql-api-client"
import { checkSimulationPreflight } from "@/lib/graphql-api-client"
import { cn } from "@/lib/cn"

export function SimulationPreflightModal({
  open,
  onOpenChange,
  preset,
  parameters,
  onLaunch,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset: SimulationPreset
  parameters: Record<string, unknown>
  onLaunch: (input: SimulationInputParams) => Promise<void>
}) {
  const [checks, setChecks] = useState<PreflightCheckResult[] | null>(null)
  const [launching, setLaunching] = useState(false)

  const runChecks = () => {
    setChecks(null)
    checkSimulationPreflight().then(setChecks)
  }

  useEffect(() => {
    if (open) runChecks()
  }, [open])

  const allRequiredPass =
    checks !== null &&
    checks.filter((c) => c.required).every((c) => c.status === "pass")

  const handleLaunch = async () => {
    setLaunching(true)
    await onLaunch({ scenario: preset.scenario, parameters })
    setLaunching(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-zinc-100">
            Pre-flight Check — {preset.name}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-1.5">
          {checks === null ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Running infrastructure checks...
            </div>
          ) : (
            checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  "flex items-start gap-3 rounded-md px-3 py-2",
                  check.status === "fail" && check.required
                    ? "bg-job-failed/5"
                    : "bg-white/[0.02]",
                )}
              >
                <StatusIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      {check.label}
                    </span>
                    {!check.required && (
                      <span className="text-[9px] text-zinc-600">optional</span>
                    )}
                  </div>
                  {check.detail && (
                    <p className="mt-0.5 text-[10px] text-zinc-500">
                      {check.detail}
                    </p>
                  )}
                  {check.fix && (
                    <div className="mt-1.5 rounded bg-dash-surface px-2 py-1.5 text-[10px] text-zinc-400 font-mono break-all">
                      <span className="font-sans font-medium text-fr-amber">
                        Fix:{" "}
                      </span>
                      {check.fix}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={runChecks}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Re-check
          </button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!allRequiredPass || launching}
              onClick={handleLaunch}
            >
              {launching ? (
                <Loader2 className="mr-1.5 size-3 animate-spin" />
              ) : (
                <Play className="mr-1.5 size-3" />
              )}
              {launching ? "Launching..." : "Launch Simulation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pass":
      return (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-job-running" />
      )
    case "fail":
      return (
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-job-failed" />
      )
    case "warn":
      return (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-fr-amber" />
      )
    default:
      return (
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-zinc-500" />
      )
  }
}
