/**
 * Linear-style kanban card for a single blue-green deployment.
 *
 * Variants follow `console-v2/deployments.html`:
 *   - pending      → no progress bar, simple labels
 *   - validating   → smoke-test progress bar
 *   - rolling-out  → blue→green progress + traffic indicator
 *   - rolling-back → coral progress, "abort" badge
 *   - complete     → `.done` modifier with completion timestamp
 */

import { SevBadge } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import type {
  BlueGreenDeployment,
  BlueGreenState,
} from "@/data/bg-deployment-types"
import type { CompatibilityVerdict } from "@/data/compatibility-types"

export type DeploymentColumn =
  | "pending"
  | "validating"
  | "rolling-out"
  | "rolling-back"
  | "complete"
  | "blocked"

/**
 * Bucket a deployment into a kanban column. An INCOMPATIBLE state-compatibility
 * verdict routes the deployment to "Blocked" regardless of its blue-green
 * phase — this is the Tier-2 advisory annotation (the CLI preflight is the
 * authoritative gate; the console cannot block the Flink operator).
 */
export function deploymentColumn(
  state: BlueGreenState,
  verdict?: CompatibilityVerdict | null,
): DeploymentColumn {
  if (verdict === "INCOMPATIBLE") return "blocked"
  switch (state) {
    case "INITIALIZING_BLUE":
      return "pending"
    case "SAVEPOINTING_BLUE":
    case "SAVEPOINTING_GREEN":
      return "validating"
    case "TRANSITIONING_TO_BLUE":
    case "TRANSITIONING_TO_GREEN":
      return "rolling-out"
    case "ACTIVE_BLUE":
    case "ACTIVE_GREEN":
      return "complete"
    default:
      return "pending"
  }
}

interface DeploymentCardProps {
  deployment: BlueGreenDeployment
  /** Latest compatibility verdict for this deployment's pipeline, if known. */
  verdict?: CompatibilityVerdict | null
  /** Number of incompatible operators in the latest check, if known. */
  issueCount?: number | null
}

const AVATAR_TONES = [
  "avatar-coral",
  "avatar-sage",
  "avatar-amber",
  "avatar-rose",
  "avatar-mixed",
  "avatar-deep",
]

function pickAvatarTone(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function shortVersion(name: string): string {
  return name.length <= 8 ? name : `${name.slice(0, 4)}…${name.slice(-3)}`
}

export function DeploymentCard({
  deployment,
  verdict,
  issueCount,
}: DeploymentCardProps) {
  const col = deploymentColumn(deployment.state, verdict)
  const isComplete = col === "complete"
  const isBlocked = col === "blocked"
  const tone = pickAvatarTone(deployment.name)
  const initial = deployment.name[0]?.toUpperCase() ?? "?"

  // Synthesize stable "progress" % from the current state for the rolling-out
  // column. Without backend telemetry we can't know real progress; a fixed
  // value per state keeps the visual stable across renders.
  const progress = col === "rolling-out" ? 60 : col === "validating" ? 40 : 0
  const trafficLabel = isComplete
    ? deployment.state === "ACTIVE_GREEN"
      ? "100% green"
      : "100% blue"
    : col === "rolling-out"
      ? deployment.state === "TRANSITIONING_TO_GREEN"
        ? `${progress}% → green`
        : `${progress}% → blue`
      : null

  return (
    <Link
      to="/hub/deployments/$name"
      params={{ name: deployment.name }}
      className={`kanban-card block ${isComplete ? "done" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-[10px] text-fg-faint uppercase tracking-wider">
          {deployment.namespace || "default"}
        </span>
        <span className="font-mono text-[10px] text-fg-muted">
          v{shortVersion(deployment.activeJobId ?? deployment.name)}
        </span>
      </div>
      <div className="text-[13px] text-zinc-100 truncate">
        {deployment.name}
      </div>
      {isBlocked ? (
        <div className="mt-1.5">
          <SevBadge tone="fail">
            {issueCount && issueCount > 0
              ? `${issueCount} op${issueCount === 1 ? "" : "s"} incompatible`
              : "incompatible state"}
          </SevBadge>
        </div>
      ) : null}
      {col === "rolling-out" || col === "validating" ? (
        <div className="resource-bar mt-2">
          <div className="seg heap" style={{ width: `${progress}%` }} />
          <div className="seg free" style={{ width: `${100 - progress}%` }} />
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-fg-faint">
        <span className="truncate">
          {trafficLabel ?? timeAgo(deployment.lastReconciledTimestamp)}
        </span>
        <span className={`avatar ${tone} h-5 w-5 text-[9px]`}>{initial}</span>
      </div>
      {deployment.error ? (
        <div className="mt-1 text-[10px] font-mono text-fr-coral truncate">
          {deployment.error}
        </div>
      ) : null}
    </Link>
  )
}
