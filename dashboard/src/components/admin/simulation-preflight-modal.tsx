import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  Loader2,
  Play,
  Server,
  XCircle,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type {
  PreflightResult,
  SimulationInputParams,
  SimulationPreset,
} from "@/lib/graphql-api-client"
import { checkSimulationPreflight } from "@/lib/graphql-api-client"
import { cn } from "@/lib/cn"

type CheckStatus = "checking" | "pass" | "fail" | "warn"

interface PreflightCheck {
  id: string
  label: string
  status: CheckStatus
  detail?: string
  fix?: string
  required: boolean
  icon: React.ComponentType<{ className?: string }>
}

function buildChecks(
  result: PreflightResult | null,
  preset: SimulationPreset,
): PreflightCheck[] {
  if (!result) {
    return [
      {
        id: "flink",
        label: "Flink cluster reachable",
        status: "checking",
        required: true,
        icon: Server,
      },
      {
        id: "storage",
        label: "PostgreSQL storage connected",
        status: "checking",
        required: true,
        icon: Database,
      },
      {
        id: "jobs",
        label: "Running jobs available",
        status: "checking",
        required: false,
        icon: Zap,
      },
      {
        id: "active",
        label: "No other simulation running",
        status: "checking",
        required: true,
        icon: Play,
      },
    ]
  }

  const checks: PreflightCheck[] = [
    {
      id: "flink",
      label: "Flink cluster reachable",
      status: result.flinkReachable ? "pass" : "fail",
      detail: result.flinkReachable
        ? "Connected to Flink REST API"
        : "Cannot reach Flink cluster",
      fix: result.flinkReachable
        ? undefined
        : "Ensure minikube is running and Flink Operator has deployed a session cluster. Check: kubectl get pods -n flink-demo",
      required: true,
      icon: Server,
    },
    {
      id: "storage",
      label: "PostgreSQL storage connected",
      status: result.storageConnected
        ? "pass"
        : result.storageEnabled
          ? "fail"
          : "fail",
      detail: result.storageConnected
        ? "Database connected and migrated"
        : result.storageEnabled
          ? "Storage enabled but database unreachable"
          : "Storage is disabled in server configuration",
      fix: result.storageConnected
        ? undefined
        : "Simulations require PostgreSQL. Ensure postgres pod is running: kubectl get pods -n flink-demo -l app=postgres",
      required: true,
      icon: Database,
    },
    {
      id: "jobs",
      label: "Running jobs available",
      status:
        result.runningJobs.length > 0
          ? "pass"
          : ["failure.kafka-restart", "failure.cascade"].includes(
                preset.scenario,
              )
            ? "warn"
            : "warn",
      detail:
        result.runningJobs.length > 0
          ? `${result.runningJobs.length} running job${result.runningJobs.length > 1 ? "s" : ""}`
          : "No running Flink jobs found",
      fix:
        result.runningJobs.length > 0
          ? undefined
          : "Deploy pipelines first: npx create-fr-app my-app --template ecommerce && cd my-app && flink-reactor deploy --env minikube",
      required: false,
      icon: Zap,
    },
    {
      id: "active",
      label: "No other simulation running",
      status: result.hasActiveSimulation ? "fail" : "pass",
      detail: result.hasActiveSimulation
        ? "Another simulation is currently active"
        : "No active simulation",
      fix: result.hasActiveSimulation
        ? "Wait for the current simulation to complete or stop it from the active simulation panel."
        : undefined,
      required: true,
      icon: Play,
    },
  ]

  return checks
}

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
  const [preflight, setPreflight] = useState<PreflightResult | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (open) {
      setPreflight(null)
      checkSimulationPreflight().then(setPreflight)
    }
  }, [open])

  const checks = buildChecks(preflight, preset)
  const allRequiredPass =
    preflight !== null &&
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

        <div className="mt-2 space-y-2">
          {checks.map((check) => (
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
                  <check.icon className="size-3 text-zinc-500" />
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
                  <div className="mt-1.5 rounded bg-dash-surface px-2 py-1.5 text-[10px] text-zinc-400">
                    <span className="font-medium text-fr-amber">Fix: </span>
                    {check.fix}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setPreflight(null)
              checkSimulationPreflight().then(setPreflight)
            }}
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

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case "checking":
      return <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-zinc-500" />
    case "pass":
      return <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-job-running" />
    case "fail":
      return <XCircle className="mt-0.5 size-3.5 shrink-0 text-job-failed" />
    case "warn":
      return <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-fr-amber" />
  }
}
