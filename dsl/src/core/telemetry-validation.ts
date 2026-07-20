// ── Telemetry label validation ───────────────────────────────────────
// `<Pipeline telemetry={{ labels }}>` labels are dual-use: they become
// Kubernetes labels on the FlinkDeployment metadata + pod template (and
// from there Prometheus labels via kubernetes_sd relabeling) AND
// console-side filter dimensions on tap/pipeline manifests. The grammar
// is therefore the INTERSECTION of Prometheus label-name rules and
// Kubernetes label-name/value rules — a label that passes here is legal
// everywhere it lands.
//
// Diagnostics are errors, not warnings: an invalid label produces a CRD
// the Kubernetes API rejects at apply time. Failing at synth is strictly
// better than failing at deploy.

import type { ValidationDiagnostic } from "./synth-context.js"
import type { ConstructNode } from "./types.js"

/** Maximum number of telemetry labels per pipeline. */
export const MAX_TELEMETRY_LABELS = 20

/**
 * Keys users may not set. `app`/`component`/`type` are stamped by the
 * Flink Kubernetes operator as pod selector labels — shadowing them
 * corrupts operator selectors and scrape configs. `pipeline`/
 * `environment` are reserved for FlinkReactor's own identity stamping.
 */
export const RESERVED_TELEMETRY_LABEL_KEYS: ReadonlySet<string> = new Set([
  "app",
  "component",
  "type",
  "pipeline",
  "environment",
])

/** Prometheus ∩ Kubernetes label-name grammar (no leading/trailing `_`). */
export const TELEMETRY_LABEL_KEY_REGEX = /^[a-zA-Z]([a-zA-Z0-9_]*[a-zA-Z0-9])?$/

/** Kubernetes label-value grammar (empty allowed). */
export const TELEMETRY_LABEL_VALUE_REGEX =
  /^[A-Za-z0-9]([-A-Za-z0-9_.]*[A-Za-z0-9])?$/

const MAX_LABEL_LENGTH = 63

/**
 * Validate `telemetry.labels` on every Pipeline node in the tree.
 * Returns `category: "structure"` error diagnostics; an empty array means
 * the labels are safe to stamp onto Kubernetes objects.
 */
export function validateTelemetryLabels(
  root: ConstructNode,
): ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = []

  const visit = (node: ConstructNode): void => {
    if (node.component === "Pipeline") {
      const telemetry = node.props.telemetry as
        | { labels?: Record<string, string> }
        | undefined
      const labels = telemetry?.labels
      if (labels) {
        validateLabelRecord(node, labels, diagnostics)
      }
    }
    for (const child of node.children) {
      visit(child)
    }
  }

  visit(root)
  return diagnostics
}

function validateLabelRecord(
  node: ConstructNode,
  labels: Readonly<Record<string, string>>,
  diagnostics: ValidationDiagnostic[],
): void {
  const error = (message: string): void => {
    diagnostics.push({
      severity: "error",
      message,
      nodeId: node.id,
      component: "Pipeline",
      category: "structure",
    })
  }

  const entries = Object.entries(labels)
  if (entries.length > MAX_TELEMETRY_LABELS) {
    error(
      `<Pipeline> '${node.id}': telemetry.labels has ${entries.length} entries — at most ${MAX_TELEMETRY_LABELS} are allowed`,
    )
  }

  for (const [key, value] of entries) {
    if (RESERVED_TELEMETRY_LABEL_KEYS.has(key)) {
      error(
        `<Pipeline> '${node.id}': telemetry label key \`${key}\` is reserved (${[...RESERVED_TELEMETRY_LABEL_KEYS].join(", ")}) — the Flink Kubernetes operator and FlinkReactor stamp these themselves`,
      )
      continue
    }
    if (key.length > MAX_LABEL_LENGTH || !TELEMETRY_LABEL_KEY_REGEX.test(key)) {
      error(
        `<Pipeline> '${node.id}': telemetry label key \`${key}\` is invalid — keys must match ${TELEMETRY_LABEL_KEY_REGEX} and be at most ${MAX_LABEL_LENGTH} characters`,
      )
    }
    if (
      value.length > 0 &&
      (value.length > MAX_LABEL_LENGTH ||
        !TELEMETRY_LABEL_VALUE_REGEX.test(value))
    ) {
      error(
        `<Pipeline> '${node.id}': telemetry label value \`${value}\` (key \`${key}\`) is invalid — values must be empty or match ${TELEMETRY_LABEL_VALUE_REGEX} and be at most ${MAX_LABEL_LENGTH} characters`,
      )
    }
  }
}
