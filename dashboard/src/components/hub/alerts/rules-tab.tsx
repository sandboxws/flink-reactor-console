import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import {
  type AlertRule,
  type AlertSeverity,
  type ConditionType,
  METRIC_DEFINITIONS,
  useAlertsStore,
} from "@/stores/alerts-store"

/**
 * Rules sub-tab — CRUD over the server-side alert rule catalog.
 *
 * Lists every rule with an enable/disable toggle, an edit button (opens a
 * pre-filled dialog), and a delete button (disabled for preset rules). The
 * "New rule" affordance opens an empty Create dialog. All mutations route
 * through the GraphQL-backed `useAlertsStore`.
 *
 * @module hub/alerts/rules-tab
 */

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "text-fr-rose",
  warning: "text-fr-coral",
  info: "text-fr-amber",
}

const METRIC_TO_TYPE: Record<string, ConditionType> = {
  "slots.freePercent": "SLOT_EXHAUSTION",
  "health.backpressure": "BACKPRESSURE",
  "checkpoints.successRate": "CHECKPOINT_FAILURE",
  "taskManagers.maxHeapPercent": "TM_MEMORY",
  "taskManagers.activeCount": "TM_LOST",
}

export function RulesTab() {
  const rules = useAlertsStore((s) => s.rules)
  const toggleRule = useAlertsStore((s) => s.toggleRule)
  const deleteRule = useAlertsStore((s) => s.deleteRule)
  const createRule = useAlertsStore((s) => s.createRule)
  const updateRule = useAlertsStore((s) => s.updateRule)

  const [editing, setEditing] = useState<AlertRule | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-fg-muted">
          {rules.length} rule{rules.length === 1 ? "" : "s"} configured ·{" "}
          {rules.filter((r) => r.isPreset).length} preset
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setCreating(true)}
        >
          <Plus />
          New rule
        </button>
      </div>

      <div className="glass-card-static overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-dash-border bg-dash-panel/40">
              <th className="px-4 py-2.5 font-medium text-fg-muted">Name</th>
              <th className="px-4 py-2.5 font-medium text-fg-muted">
                Condition
              </th>
              <th className="px-4 py-2.5 font-medium text-fg-muted">
                Threshold
              </th>
              <th className="px-4 py-2.5 font-medium text-fg-muted">
                Severity
              </th>
              <th className="px-4 py-2.5 font-medium text-fg-muted">Enabled</th>
              <th className="px-4 py-2.5 font-medium text-fg-muted">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-fg-muted"
                >
                  No rules yet. Click "New rule" to create one.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-dash-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-100">
                    {rule.name}
                    {rule.isPreset ? (
                      <span className="ml-2 inline-block rounded bg-dash-elevated px-1.5 py-0.5 text-[10px] text-fg-muted">
                        preset
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {rule.conditionType ?? rule.metric}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-zinc-200">
                    {rule.condition} {rule.threshold}
                  </td>
                  <td
                    className={`px-4 py-2.5 ${SEVERITY_COLORS[rule.severity]}`}
                  >
                    {rule.severity}
                  </td>
                  <td className="px-4 py-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => {
                          void toggleRule(rule.id)
                        }}
                      />
                      <span className="text-fg-muted">
                        {rule.enabled ? "on" : "off"}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label="Edit rule"
                      onClick={() => setEditing(rule)}
                    >
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label="Delete rule"
                      disabled={rule.isPreset}
                      onClick={() => {
                        if (rule.isPreset) return
                        if (confirm(`Delete rule "${rule.name}"?`)) {
                          void deleteRule(rule.id)
                        }
                      }}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <RuleDialog
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={async (input) => {
            if (editing) {
              await updateRule(editing.id, input)
            } else {
              await createRule({
                ...input,
                requiredConsecutive: 1,
                isPreset: false,
              } as Omit<AlertRule, "id" | "isPreset">)
            }
            setCreating(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

interface RuleDialogProps {
  initial: AlertRule | null
  onClose: () => void
  onSubmit: (
    input: Omit<AlertRule, "id" | "isPreset" | "requiredConsecutive">,
  ) => Promise<void> | void
}

function RuleDialog({ initial, onClose, onSubmit }: RuleDialogProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [metric, setMetric] = useState(
    initial?.metric ?? METRIC_DEFINITIONS[0]?.id ?? "slots.freePercent",
  )
  const [threshold, setThreshold] = useState<number>(initial?.threshold ?? 10)
  const [severity, setSeverity] = useState<AlertSeverity>(
    initial?.severity ?? "warning",
  )
  const [enabled, setEnabled] = useState<boolean>(initial?.enabled ?? true)

  const conditionType =
    initial?.conditionType ?? METRIC_TO_TYPE[metric] ?? "SLOT_EXHAUSTION"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-md border border-dash-border bg-dash-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[14px] font-semibold text-zinc-100">
          {initial ? "Edit rule" : "New rule"}
        </h2>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            const op = inferOperator(conditionType)
            void onSubmit({
              name: name.trim() || conditionType,
              metric,
              condition: op,
              threshold,
              severity,
              enabled,
              conditionType,
            })
          }}
        >
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
            />
          </Field>

          <Field label="Condition type">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="input w-full"
              disabled={initial?.isPreset}
            >
              {METRIC_DEFINITIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`Threshold (server type: ${conditionType})`}>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="input w-full"
              step="0.1"
            />
          </Field>

          <Field label="Severity">
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
              className="input w-full"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 text-[12px] text-fg-muted">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              {initial ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-fg-muted">{label}</span>
      {children}
    </label>
  )
}

function inferOperator(type: ConditionType): AlertRule["condition"] {
  return type === "TM_MEMORY" ? ">" : "<"
}
