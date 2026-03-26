import { create } from "zustand"
import { useCheckpointAnalyticsStore } from "./checkpoint-analytics-store"
import { useClusterStore } from "./cluster-store"
import { useInsightsStore } from "./insights-store"

/**
 * Alerts store — rule-based alerting evaluated against live cluster metrics.
 *
 * Subscribes to cluster-store changes and evaluates user-defined + preset alert
 * rules on each update. Rules require N consecutive violations before firing.
 * Alerts auto-resolve when conditions clear. Rules and active alerts are
 * persisted to localStorage.
 *
 * @module alerts-store
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Comparison operator for alert rule conditions. */
export type AlertCondition = ">" | "<" | "==" | "!=" | ">=" | "<="

/** Alert severity level. */
export type AlertSeverity = "info" | "warning" | "critical"

/** A configured alert rule that evaluates a metric against a threshold. */
export type AlertRule = {
  /** Unique rule identifier. */
  id: string
  /** Human-readable rule name (e.g. "Slot Exhaustion"). */
  name: string
  /** Metric ID to evaluate (e.g. "slots.freePercent"). */
  metric: string
  /** Comparison operator. */
  condition: AlertCondition
  /** Threshold value for the comparison. */
  threshold: number
  /** Number of consecutive violations required before firing. */
  requiredConsecutive: number
  /** Severity assigned to alerts fired by this rule. */
  severity: AlertSeverity
  /** Whether this rule is actively evaluated. */
  enabled: boolean
  /** True for built-in preset rules (cannot be deleted). */
  isPreset: boolean
}

/** An active alert fired when a rule's condition is met. */
export type ActiveAlert = {
  /** Unique alert instance identifier. */
  id: string
  /** ID of the rule that fired this alert. */
  ruleId: string
  /** Name of the rule that fired this alert. */
  ruleName: string
  /** Severity inherited from the rule. */
  severity: AlertSeverity
  /** Human-readable alert message with current value and threshold. */
  message: string
  /** Current metric value at the time of evaluation. */
  currentValue: number
  /** Threshold from the rule configuration. */
  threshold: number
  /** When this alert was first triggered. */
  triggeredAt: Date
  /** Whether the user has acknowledged this alert. */
  acknowledged: boolean
}

// ---------------------------------------------------------------------------
// Metric definitions — available metrics grouped by source
// ---------------------------------------------------------------------------

/** Definition of an alertable metric with display label and category group. */
export type MetricDefinition = {
  /** Metric identifier used in alert rules (e.g. "slots.freePercent"). */
  id: string
  /** Human-readable label shown in the UI. */
  label: string
  /** Category group for organizing metrics in the picker. */
  group: string
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  // Cluster
  { id: "slots.freePercent", label: "Free Slots %", group: "Cluster" },
  { id: "slots.total", label: "Total Slots", group: "Cluster" },
  { id: "taskManagers.count", label: "TM Count (overview)", group: "Cluster" },
  // Health
  { id: "health.score", label: "Health Score", group: "Health" },
  {
    id: "health.slotUtilization",
    label: "Slot Utilization Score",
    group: "Health",
  },
  { id: "health.backpressure", label: "Backpressure Score", group: "Health" },
  {
    id: "health.checkpointHealth",
    label: "Checkpoint Health Score",
    group: "Health",
  },
  {
    id: "health.memoryPressure",
    label: "Memory Pressure Score",
    group: "Health",
  },
  {
    id: "health.exceptionRate",
    label: "Exception Rate Score",
    group: "Health",
  },
  // Checkpoints
  {
    id: "checkpoints.successRate",
    label: "Success Rate %",
    group: "Checkpoints",
  },
  {
    id: "checkpoints.avgDuration",
    label: "Avg Duration (ms)",
    group: "Checkpoints",
  },
  {
    id: "checkpoints.totalStateSize",
    label: "Total State Size (bytes)",
    group: "Checkpoints",
  },
  // Task Managers
  {
    id: "taskManagers.maxHeapPercent",
    label: "Max Heap Usage %",
    group: "Task Managers",
  },
  {
    id: "taskManagers.activeCount",
    label: "Active TM Count",
    group: "Task Managers",
  },
  // Jobs
  { id: "jobs.runningCount", label: "Running Jobs", group: "Jobs" },
  { id: "jobs.failedCount", label: "Failed Jobs", group: "Jobs" },
]

// ---------------------------------------------------------------------------
// Metric value extractors
// ---------------------------------------------------------------------------

/** Extract the current value of a metric by reading from the relevant store(s). Returns null if unavailable. */
function getMetricValue(metricId: string): number | null {
  const cluster = useClusterStore.getState()
  const insights = useInsightsStore.getState()
  const checkpoints = useCheckpointAnalyticsStore.getState()

  switch (metricId) {
    // Cluster metrics
    case "slots.freePercent": {
      const { overview } = cluster
      if (!overview || overview.totalTaskSlots === 0) return null
      return (overview.availableTaskSlots / overview.totalTaskSlots) * 100
    }
    case "slots.total":
      return cluster.overview?.totalTaskSlots ?? null
    case "taskManagers.count":
      return cluster.overview?.taskManagerCount ?? null

    // Health metrics — null if insights store not initialized
    case "health.score":
      return insights.currentHealth?.score ?? null
    case "health.slotUtilization": {
      const sub = insights.currentHealth?.subScores.find(
        (s) => s.name === "Slot Utilization",
      )
      return sub?.score ?? null
    }
    case "health.backpressure": {
      const sub = insights.currentHealth?.subScores.find(
        (s) => s.name === "Backpressure",
      )
      return sub?.score ?? null
    }
    case "health.checkpointHealth": {
      const sub = insights.currentHealth?.subScores.find(
        (s) => s.name === "Checkpoint Health",
      )
      return sub?.score ?? null
    }
    case "health.memoryPressure": {
      const sub = insights.currentHealth?.subScores.find(
        (s) => s.name === "Memory Pressure",
      )
      return sub?.score ?? null
    }
    case "health.exceptionRate": {
      const sub = insights.currentHealth?.subScores.find(
        (s) => s.name === "Exception Rate",
      )
      return sub?.score ?? null
    }

    // Checkpoint metrics — null if checkpoint store not initialized
    case "checkpoints.successRate":
      return checkpoints.aggregates?.overallSuccessRate ?? null
    case "checkpoints.avgDuration":
      return checkpoints.aggregates?.avgDuration ?? null
    case "checkpoints.totalStateSize":
      return checkpoints.aggregates?.totalStateSize ?? null

    // Task Manager metrics
    case "taskManagers.maxHeapPercent": {
      const { taskManagers } = cluster
      if (taskManagers.length === 0) return null
      let maxHeapPct = 0
      for (const tm of taskManagers) {
        if (!tm.metrics || tm.metrics.heapMax === 0) continue
        const pct = (tm.metrics.heapUsed / tm.metrics.heapMax) * 100
        if (pct > maxHeapPct) maxHeapPct = pct
      }
      return maxHeapPct
    }
    case "taskManagers.activeCount":
      return cluster.taskManagers.length

    // Job metrics
    case "jobs.runningCount":
      return cluster.runningJobs.length
    case "jobs.failedCount":
      return cluster.completedJobs.filter((j) => j.status === "FAILED").length

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

/** Evaluate a comparison condition (e.g. value > threshold). */
function evaluateCondition(
  value: number,
  condition: AlertCondition,
  threshold: number,
): boolean {
  switch (condition) {
    case ">":
      return value > threshold
    case "<":
      return value < threshold
    case "==":
      return value === threshold
    case "!=":
      return value !== threshold
    case ">=":
      return value >= threshold
    case "<=":
      return value <= threshold
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const RULES_KEY = "flink-reactor-alert-rules"
const ALERTS_KEY = "flink-reactor-active-alerts"

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage may be unavailable
  }
}

function loadRules(): AlertRule[] {
  return loadFromStorage<AlertRule[]>(RULES_KEY, [])
}

function loadAlerts(): ActiveAlert[] {
  const raw = loadFromStorage<
    Array<Omit<ActiveAlert, "triggeredAt"> & { triggeredAt: string }>
  >(ALERTS_KEY, [])
  return raw.map((a) => ({
    ...a,
    triggeredAt: new Date(a.triggeredAt),
  }))
}

function saveRules(rules: AlertRule[]): void {
  saveToStorage(RULES_KEY, rules)
}

function saveAlerts(alerts: ActiveAlert[]): void {
  saveToStorage(ALERTS_KEY, alerts)
}

// ---------------------------------------------------------------------------
// Preset rules
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID()
}

function createPresetRules(): AlertRule[] {
  return [
    {
      id: generateId(),
      name: "Slot Exhaustion",
      metric: "slots.freePercent",
      condition: "<",
      threshold: 10,
      requiredConsecutive: 2,
      severity: "critical",
      enabled: true,
      isPreset: true,
    },
    {
      id: generateId(),
      name: "High Backpressure",
      metric: "health.backpressure",
      condition: "<",
      threshold: 40,
      requiredConsecutive: 3,
      severity: "warning",
      enabled: true,
      isPreset: true,
    },
    {
      id: generateId(),
      name: "Checkpoint Failure",
      metric: "checkpoints.successRate",
      condition: "<",
      threshold: 90,
      requiredConsecutive: 2,
      severity: "warning",
      enabled: true,
      isPreset: true,
    },
    {
      id: generateId(),
      name: "TM Memory Pressure",
      metric: "taskManagers.maxHeapPercent",
      condition: ">",
      threshold: 90,
      requiredConsecutive: 3,
      severity: "critical",
      enabled: true,
      isPreset: true,
    },
    {
      id: generateId(),
      name: "Task Manager Lost",
      metric: "taskManagers.activeCount",
      condition: "<",
      threshold: 0, // dynamic — set on install to current count
      requiredConsecutive: 1,
      severity: "critical",
      enabled: true,
      isPreset: true,
    },
  ]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AlertsState {
  /** All configured alert rules (user-created + presets). */
  rules: AlertRule[]
  /** Currently active (fired) alerts. */
  activeAlerts: ActiveAlert[]
  /** Consecutive violation count per rule ID (for requiredConsecutive logic). */
  consecutiveViolations: Record<string, number>

  /** Load rules from localStorage, install presets if needed, subscribe to cluster-store. */
  initialize: () => void
  /** Unsubscribe from cluster-store and reset initialization guard. */
  stopListening: () => void
  /** Create a new custom alert rule. */
  createRule: (rule: Omit<AlertRule, "id" | "isPreset">) => void
  /** Update fields on an existing rule. */
  updateRule: (id: string, updates: Partial<AlertRule>) => void
  /** Delete a custom rule (preset rules cannot be deleted). */
  deleteRule: (id: string) => void
  /** Toggle a rule's enabled state (disabling auto-resolves its active alert). */
  toggleRule: (id: string) => void
  /** Mark an active alert as acknowledged by the user. */
  acknowledgeAlert: (alertId: string) => void
  /** Manually resolve (dismiss) an active alert. */
  resolveAlert: (alertId: string) => void
  /** Resolve all active alerts at once. */
  resolveAllAlerts: () => void
  /** Install the default preset rules (slot exhaustion, backpressure, etc.). */
  installPresets: () => void
}

let alertsInitialized = false
let unsubCluster: (() => void) | null = null

/** Evaluate all enabled rules against current metric values, firing/resolving alerts as needed. */
function evaluateRules(
  set: (
    partial:
      | Partial<AlertsState>
      | ((state: AlertsState) => Partial<AlertsState>),
  ) => void,
  get: () => AlertsState,
): void {
  const { rules, activeAlerts, consecutiveViolations } = get()
  const newViolations = { ...consecutiveViolations }
  let newAlerts = [...activeAlerts]
  let changed = false

  for (const rule of rules) {
    if (!rule.enabled) continue

    const value = getMetricValue(rule.metric)

    // Metric unavailable — skip (don't fire, don't reset)
    if (value === null) continue

    const violated = evaluateCondition(value, rule.condition, rule.threshold)
    const existingAlert = newAlerts.find((a) => a.ruleId === rule.id)

    if (violated) {
      const prev = newViolations[rule.id] ?? 0
      newViolations[rule.id] = prev + 1

      if (
        newViolations[rule.id] >= rule.requiredConsecutive &&
        !existingAlert
      ) {
        // Fire new alert
        newAlerts.push({
          id: generateId(),
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: formatAlertMessage(rule, value),
          currentValue: value,
          threshold: rule.threshold,
          triggeredAt: new Date(),
          acknowledged: false,
        })
        changed = true
      } else if (existingAlert) {
        // Update the current value on existing alert
        const idx = newAlerts.indexOf(existingAlert)
        newAlerts[idx] = {
          ...existingAlert,
          currentValue: value,
          message: formatAlertMessage(rule, value),
        }
        changed = true
      }
    } else {
      // Condition cleared
      newViolations[rule.id] = 0

      if (existingAlert) {
        // Auto-resolve
        newAlerts = newAlerts.filter((a) => a.ruleId !== rule.id)
        changed = true
      }
    }
  }

  if (
    changed ||
    Object.keys(newViolations).length !==
      Object.keys(consecutiveViolations).length
  ) {
    set({
      activeAlerts: newAlerts,
      consecutiveViolations: newViolations,
    })
    saveAlerts(newAlerts)
  }
}

/** Format a human-readable alert message from a rule and its current metric value. */
function formatAlertMessage(rule: AlertRule, currentValue: number): string {
  const metricDef = METRIC_DEFINITIONS.find((m) => m.id === rule.metric)
  const label = metricDef?.label ?? rule.metric
  const formatted = Number.isInteger(currentValue)
    ? String(currentValue)
    : currentValue.toFixed(1)
  return `${label} at ${formatted} (threshold: ${rule.condition} ${rule.threshold})`
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  rules: [],
  activeAlerts: [],
  consecutiveViolations: {},

  initialize: () => {
    if (alertsInitialized) return
    alertsInitialized = true

    // Load from localStorage
    const rules = loadRules()
    const activeAlerts = loadAlerts()
    set({ rules, activeAlerts })

    // Install presets if needed
    if (!rules.some((r) => r.isPreset)) {
      get().installPresets()
    }

    // Subscribe to cluster-store changes for evaluation
    unsubCluster = useClusterStore.subscribe(() => {
      evaluateRules(set, get)
    })

    // Run initial evaluation
    evaluateRules(set, get)
  },

  stopListening: () => {
    if (unsubCluster) {
      unsubCluster()
      unsubCluster = null
    }
    alertsInitialized = false
  },

  installPresets: () => {
    const { rules } = get()
    if (rules.some((r) => r.isPreset)) return

    const presets = createPresetRules()

    // Set dynamic threshold for "Task Manager Lost"
    const tmCount = useClusterStore.getState().taskManagers.length
    const tmLostPreset = presets.find((p) => p.name === "Task Manager Lost")
    if (tmLostPreset) {
      tmLostPreset.threshold = tmCount
    }

    const updated = [...rules, ...presets]
    set({ rules: updated })
    saveRules(updated)
  },

  createRule: (ruleInput) => {
    const rule: AlertRule = {
      ...ruleInput,
      id: generateId(),
      isPreset: false,
    }
    const updated = [...get().rules, rule]
    set({ rules: updated })
    saveRules(updated)
  },

  updateRule: (id, updates) => {
    const updated = get().rules.map((r) =>
      r.id === id ? { ...r, ...updates } : r,
    )
    set({ rules: updated })
    saveRules(updated)
  },

  deleteRule: (id) => {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule || rule.isPreset) return

    const updatedRules = get().rules.filter((r) => r.id !== id)
    const updatedAlerts = get().activeAlerts.filter((a) => a.ruleId !== id)
    const { [id]: _, ...updatedViolations } = get().consecutiveViolations

    set({
      rules: updatedRules,
      activeAlerts: updatedAlerts,
      consecutiveViolations: updatedViolations,
    })
    saveRules(updatedRules)
    saveAlerts(updatedAlerts)
  },

  toggleRule: (id) => {
    const rules = get().rules
    const rule = rules.find((r) => r.id === id)
    if (!rule) return

    const updatedRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    )

    // If disabling, resolve any active alert and reset violations
    let updatedAlerts = get().activeAlerts
    const updatedViolations = { ...get().consecutiveViolations }
    if (rule.enabled) {
      updatedAlerts = updatedAlerts.filter((a) => a.ruleId !== id)
      updatedViolations[id] = 0
    }

    set({
      rules: updatedRules,
      activeAlerts: updatedAlerts,
      consecutiveViolations: updatedViolations,
    })
    saveRules(updatedRules)
    saveAlerts(updatedAlerts)
  },

  acknowledgeAlert: (alertId) => {
    const updated = get().activeAlerts.map((a) =>
      a.id === alertId ? { ...a, acknowledged: true } : a,
    )
    set({ activeAlerts: updated })
    saveAlerts(updated)
  },

  resolveAlert: (alertId) => {
    const updated = get().activeAlerts.filter((a) => a.id !== alertId)
    set({ activeAlerts: updated })
    saveAlerts(updated)
  },

  resolveAllAlerts: () => {
    set({ activeAlerts: [] })
    saveAlerts([])
  },
}))
