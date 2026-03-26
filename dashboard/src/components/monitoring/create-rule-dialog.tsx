/**
 * @module create-rule-dialog
 * Modal dialog for creating a new {@link AlertRule}. Presents a form with metric
 * selection (grouped by source), comparison condition, threshold, consecutive-poll
 * count, and severity level. Resets form state on successful creation.
 */
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@flink-reactor/ui"
import { useState } from "react"
import {
  type AlertCondition,
  type AlertRule,
  type AlertSeverity,
  METRIC_DEFINITIONS,
} from "@/stores/alerts-store"

/** Props for {@link CreateRuleDialog}. */
type CreateRuleDialogProps = {
  /** Whether the dialog is open. */
  open: boolean
  /** Callback to toggle dialog visibility. */
  onOpenChange: (open: boolean) => void
  /** Called with the new rule payload (ID and isPreset are assigned by the store). */
  onCreate: (rule: Omit<AlertRule, "id" | "isPreset">) => void
}

/** Comparison operators available for alert rule conditions. */
const CONDITION_OPTIONS: { value: AlertCondition; label: string }[] = [
  { value: ">", label: "> (greater than)" },
  { value: "<", label: "< (less than)" },
  { value: "==", label: "== (equal)" },
  { value: "!=", label: "!= (not equal)" },
  { value: ">=", label: ">= (greater or equal)" },
  { value: "<=", label: "<= (less or equal)" },
]

/** Alert severity levels for user selection. */
const SEVERITY_OPTIONS: { value: AlertSeverity; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
]

/** Metrics grouped by their source category for the select dropdown. */
const METRIC_GROUPS = METRIC_DEFINITIONS.reduce(
  (groups, m) => {
    if (!groups[m.group]) groups[m.group] = []
    groups[m.group].push(m)
    return groups
  },
  {} as Record<string, typeof METRIC_DEFINITIONS>,
)

/**
 * Modal form for defining a new alert rule. Metrics are presented in grouped
 * select menus sourced from {@link METRIC_DEFINITIONS}. The form validates that
 * name, metric, and threshold are non-empty before enabling submission.
 */
export function CreateRuleDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateRuleDialogProps) {
  const [name, setName] = useState("")
  const [metric, setMetric] = useState("")
  const [condition, setCondition] = useState<AlertCondition>(">")
  const [threshold, setThreshold] = useState("")
  const [consecutive, setConsecutive] = useState("2")
  const [severity, setSeverity] = useState<AlertSeverity>("warning")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !metric || !threshold.trim()) return

    onCreate({
      name: name.trim(),
      metric,
      condition,
      threshold: Number(threshold),
      requiredConsecutive: Math.max(1, Number(consecutive) || 2),
      severity,
      enabled: true,
    })

    // Reset form
    setName("")
    setMetric("")
    setCondition(">")
    setThreshold("")
    setConsecutive("2")
    setSeverity("warning")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Alert Rule</DialogTitle>
          <DialogDescription>
            Define conditions that trigger alerts when thresholds are crossed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Rule name */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="e.g. High Memory Usage"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Metric */}
          <div className="space-y-1.5">
            <Label>Metric</Label>
            <Select value={metric} onValueChange={setMetric} required>
              <SelectTrigger>
                <SelectValue placeholder="Select metric..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METRIC_GROUPS).map(([group, metrics]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {metrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition + Threshold row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as AlertCondition)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Threshold</Label>
              <Input
                id="threshold"
                type="number"
                step="any"
                placeholder="e.g. 90"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Consecutive + Severity row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="consecutive">Consecutive Polls</Label>
              <Input
                id="consecutive"
                type="number"
                min="1"
                value={consecutive}
                onChange={(e) => setConsecutive(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as AlertSeverity)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !metric || !threshold.trim()}
            >
              Create Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
