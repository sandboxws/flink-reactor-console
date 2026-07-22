import { gql } from "urql"
import { create } from "zustand"
import { graphqlClient } from "@/lib/graphql-client"

/**
 * Alerts store — GraphQL-backed thin wrapper over the server-side alerts
 * engine. Polls `activeAlerts` and `alertRules` at a fixed interval and
 * exposes the legacy public API so existing components (`AlertRow`,
 * `AlertFilterRail`, etc.) keep working without changes.
 *
 * Persistence, evaluation, dedup, and lifecycle are all handled by the Go
 * server's `internal/alerts` package. The store is a presentation cache.
 *
 * @module alerts-store
 */

// ---------------------------------------------------------------------------
// Public types (preserved for component compatibility)
// ---------------------------------------------------------------------------

export type AlertCondition = ">" | "<" | "==" | "!=" | ">=" | "<="
export type AlertSeverity = "info" | "warning" | "critical"

export type ConditionType =
  | "SLOT_EXHAUSTION"
  | "BACKPRESSURE"
  | "CHECKPOINT_FAILURE"
  | "TM_MEMORY"
  | "TM_LOST"
  | "PROCESS_MEMORY_HEADROOM"
  | "GC_PRESSURE"

export type AlertRule = {
  id: string
  name: string
  metric: string
  condition: AlertCondition
  threshold: number
  requiredConsecutive: number
  severity: AlertSeverity
  enabled: boolean
  isPreset: boolean
  /** New: structured condition type from the server. */
  conditionType?: ConditionType
}

export type ActiveAlert = {
  id: string
  ruleId: string
  ruleName: string
  severity: AlertSeverity
  message: string
  currentValue: number
  threshold: number
  triggeredAt: Date
  acknowledged: boolean
}

export type MetricDefinition = {
  id: string
  label: string
  group: string
}

// The five v1 metrics that map 1:1 onto a server condition type.
export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "slots.freePercent",
    label: "Free Slots % (slot exhaustion)",
    group: "Cluster",
  },
  {
    id: "health.backpressure",
    label: "Backpressure Score",
    group: "Health",
  },
  {
    id: "checkpoints.successRate",
    label: "Checkpoint Success Rate %",
    group: "Checkpoints",
  },
  {
    id: "taskManagers.maxHeapPercent",
    label: "TM Max Heap %",
    group: "Task Managers",
  },
  {
    id: "taskManagers.activeCount",
    label: "Active TM Count (TM lost)",
    group: "Task Managers",
  },
  {
    id: "taskManagers.processMemoryPercent",
    label: "TM Process Memory % (headroom to OOM)",
    group: "Task Managers",
  },
  {
    id: "taskManagers.gcPressure",
    label: "TM GC Rate ms/s (GC pressure)",
    group: "Task Managers",
  },
]

// ---------------------------------------------------------------------------
// GraphQL documents (mirror dashboard/src/graphql/documents/alerts.graphql)
// ---------------------------------------------------------------------------

const ACTIVE_ALERTS_QUERY = gql`
  query StoreActiveAlerts {
    activeAlerts {
      id
      ruleId
      state
      firedAt
      currentValue
      message
    }
    alertRules {
      id
      name
      condition {
        type
        threshold
      }
      severity
      isPreset
      enabled
    }
  }
`

const CREATE_RULE_MUTATION = gql`
  mutation StoreCreateRule($input: CreateAlertRuleInput!) {
    createAlertRule(input: $input) {
      id
    }
  }
`

const UPDATE_RULE_MUTATION = gql`
  mutation StoreUpdateRule($id: ID!, $input: UpdateAlertRuleInput!) {
    updateAlertRule(id: $id, input: $input) {
      id
    }
  }
`

const DELETE_RULE_MUTATION = gql`
  mutation StoreDeleteRule($id: ID!) {
    deleteAlertRule(id: $id) {
      success
    }
  }
`

const ACK_MUTATION = gql`
  mutation StoreAck($id: ID!) {
    acknowledgeAlert(id: $id) {
      id
    }
  }
`

const RESOLVE_MUTATION = gql`
  mutation StoreResolve($id: ID!) {
    resolveAlert(id: $id) {
      id
    }
  }
`

// ---------------------------------------------------------------------------
// Condition <-> Metric mapping
// ---------------------------------------------------------------------------

// Maps a legacy `metric` id to the server's structured condition type.
const METRIC_TO_CONDITION_TYPE: Record<string, ConditionType> = {
  "slots.freePercent": "SLOT_EXHAUSTION",
  "health.backpressure": "BACKPRESSURE",
  "checkpoints.successRate": "CHECKPOINT_FAILURE",
  "taskManagers.maxHeapPercent": "TM_MEMORY",
  "taskManagers.activeCount": "TM_LOST",
  "taskManagers.processMemoryPercent": "PROCESS_MEMORY_HEADROOM",
  "taskManagers.gcPressure": "GC_PRESSURE",
}

const CONDITION_TYPE_TO_METRIC: Record<ConditionType, string> = {
  SLOT_EXHAUSTION: "slots.freePercent",
  BACKPRESSURE: "health.backpressure",
  CHECKPOINT_FAILURE: "checkpoints.successRate",
  TM_MEMORY: "taskManagers.maxHeapPercent",
  TM_LOST: "taskManagers.activeCount",
  PROCESS_MEMORY_HEADROOM: "taskManagers.processMemoryPercent",
  GC_PRESSURE: "taskManagers.gcPressure",
}

// "Less is worse" condition types use < operator; "more is worse" use >.
const CONDITION_TYPE_TO_OPERATOR: Record<ConditionType, AlertCondition> = {
  SLOT_EXHAUSTION: "<",
  BACKPRESSURE: "<",
  CHECKPOINT_FAILURE: "<",
  TM_MEMORY: ">",
  TM_LOST: "<",
  PROCESS_MEMORY_HEADROOM: ">",
  GC_PRESSURE: ">",
}

function metricToConditionType(metric: string): ConditionType | null {
  return METRIC_TO_CONDITION_TYPE[metric] ?? null
}

function serverToRule(server: ServerRule): AlertRule {
  const metric = CONDITION_TYPE_TO_METRIC[server.condition.type]
  const op = CONDITION_TYPE_TO_OPERATOR[server.condition.type]
  return {
    id: server.id,
    name: server.name,
    metric,
    condition: op,
    threshold: server.condition.threshold,
    requiredConsecutive: 1,
    severity: server.severity,
    enabled: server.enabled,
    isPreset: server.isPreset,
    conditionType: server.condition.type,
  }
}

// ---------------------------------------------------------------------------
// Server response shapes
// ---------------------------------------------------------------------------

type ServerRule = {
  id: string
  name: string
  condition: { type: ConditionType; threshold: number }
  severity: AlertSeverity
  isPreset: boolean
  enabled: boolean
}

type ServerInstance = {
  id: string
  ruleId: string
  state: "FIRING" | "ACKNOWLEDGED" | "SILENCED" | "RESOLVED"
  firedAt: string
  currentValue: number | null
  message: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AlertsState {
  rules: AlertRule[]
  activeAlerts: ActiveAlert[]
  /** Retained for legacy API compatibility; always {} under the new engine. */
  consecutiveViolations: Record<string, number>

  initialize: () => void
  stopListening: () => void
  createRule: (rule: Omit<AlertRule, "id" | "isPreset">) => Promise<void>
  updateRule: (id: string, updates: Partial<AlertRule>) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  toggleRule: (id: string) => Promise<void>
  acknowledgeAlert: (alertId: string) => Promise<void>
  resolveAlert: (alertId: string) => Promise<void>
  resolveAllAlerts: () => Promise<void>
  /** Legacy no-op: presets are now managed server-side. */
  installPresets: () => void
}

const POLL_INTERVAL_MS = 3000
let pollHandle: ReturnType<typeof setInterval> | null = null
let initialized = false

async function fetchSnapshot(): Promise<{
  rules: AlertRule[]
  activeAlerts: ActiveAlert[]
}> {
  const result = await graphqlClient
    .query<{ activeAlerts: ServerInstance[]; alertRules: ServerRule[] }>(
      ACTIVE_ALERTS_QUERY,
      {},
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (result.error) throw result.error
  const rawRules = result.data?.alertRules ?? []
  const rawInstances = result.data?.activeAlerts ?? []
  const rules = rawRules.map(serverToRule)
  const rulesById = new Map(rules.map((r) => [r.id, r]))
  const activeAlerts: ActiveAlert[] = rawInstances.map((inst) => {
    const rule = rulesById.get(inst.ruleId)
    return {
      id: inst.id,
      ruleId: inst.ruleId,
      ruleName: rule?.name ?? "(unknown rule)",
      severity: rule?.severity ?? "warning",
      message: inst.message,
      currentValue: inst.currentValue ?? 0,
      threshold: rule?.threshold ?? 0,
      triggeredAt: new Date(inst.firedAt),
      acknowledged: inst.state === "ACKNOWLEDGED",
    }
  })
  return { rules, activeAlerts }
}

function buildConditionInput(rule: Partial<AlertRule>): {
  type: ConditionType
  threshold: number
} {
  const conditionType =
    rule.conditionType ?? metricToConditionType(rule.metric ?? "") ?? null
  if (!conditionType) {
    throw new Error(
      `Unsupported metric "${rule.metric}". Use one of the v1 condition types.`,
    )
  }
  return { type: conditionType, threshold: rule.threshold ?? 0 }
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  rules: [],
  activeAlerts: [],
  consecutiveViolations: {},

  initialize: () => {
    if (initialized) return
    initialized = true

    const refresh = async () => {
      try {
        const snap = await fetchSnapshot()
        set({ rules: snap.rules, activeAlerts: snap.activeAlerts })
      } catch (err) {
        console.warn("alerts: refresh failed", err)
      }
    }

    void refresh()
    pollHandle = setInterval(refresh, POLL_INTERVAL_MS)
  },

  stopListening: () => {
    if (pollHandle) {
      clearInterval(pollHandle)
      pollHandle = null
    }
    initialized = false
  },

  installPresets: () => {
    // No-op: presets are seeded server-side (or via a dedicated seed step).
  },

  async createRule(ruleInput) {
    const condition = buildConditionInput(ruleInput)
    const result = await graphqlClient
      .mutation(CREATE_RULE_MUTATION, {
        input: {
          name: ruleInput.name,
          condition,
          severity: ruleInput.severity,
          enabled: ruleInput.enabled,
        },
      })
      .toPromise()
    if (result.error) throw result.error
    await refreshNow(set)
  },

  async updateRule(id, updates) {
    const current = get().rules.find((r) => r.id === id)
    if (!current) return
    const merged = { ...current, ...updates }
    const condition = buildConditionInput(merged)
    const result = await graphqlClient
      .mutation(UPDATE_RULE_MUTATION, {
        id,
        input: {
          name: merged.name,
          condition,
          severity: merged.severity,
          enabled: merged.enabled,
        },
      })
      .toPromise()
    if (result.error) throw result.error
    await refreshNow(set)
  },

  async deleteRule(id) {
    const result = await graphqlClient
      .mutation(DELETE_RULE_MUTATION, { id })
      .toPromise()
    if (result.error) throw result.error
    await refreshNow(set)
  },

  async toggleRule(id) {
    const rule = get().rules.find((r) => r.id === id)
    if (!rule) return
    await get().updateRule(id, { enabled: !rule.enabled })
  },

  async acknowledgeAlert(alertId) {
    const result = await graphqlClient
      .mutation(ACK_MUTATION, { id: alertId })
      .toPromise()
    if (result.error) throw result.error
    await refreshNow(set)
  },

  async resolveAlert(alertId) {
    const result = await graphqlClient
      .mutation(RESOLVE_MUTATION, { id: alertId })
      .toPromise()
    if (result.error) throw result.error
    await refreshNow(set)
  },

  async resolveAllAlerts() {
    const ids = get().activeAlerts.map((a) => a.id)
    await Promise.all(
      ids.map((id) =>
        graphqlClient.mutation(RESOLVE_MUTATION, { id }).toPromise(),
      ),
    )
    await refreshNow(set)
  },
}))

async function refreshNow(set: (partial: Partial<AlertsState>) => void) {
  try {
    const snap = await fetchSnapshot()
    set({ rules: snap.rules, activeAlerts: snap.activeAlerts })
  } catch (err) {
    console.warn("alerts: refresh-after-mutation failed", err)
  }
}
