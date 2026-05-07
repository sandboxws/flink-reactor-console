/**
 * 5-column Linear-style kanban for blue-green deployments.
 *
 * Reads `useBgDeploymentStore.deployments` and buckets them into:
 *   Pending / Validating / Rolling out / Rolling back / Complete
 *
 * Column count headers update in real time as the store re-fetches (every
 * 5s). When a deployment transitions state, the card moves columns without
 * a page reload — the card key is the deployment name, so React reuses the
 * DOM node across columns.
 */

import { useMemo } from "react"
import type { BlueGreenDeployment } from "@/data/bg-deployment-types"
import {
  DeploymentCard,
  type DeploymentColumn,
  deploymentColumn,
} from "./deployment-card"
import { KanbanColumn } from "./kanban-column"

const COLUMN_ORDER: DeploymentColumn[] = [
  "pending",
  "validating",
  "rolling-out",
  "rolling-back",
  "complete",
]

const COLUMN_META: Record<
  DeploymentColumn,
  {
    name: string
    state: "firing" | "in-progress" | "acknowledged" | "resolved" | "suppressed"
    emptyMessage: string
  }
> = {
  pending: {
    name: "Pending",
    state: "suppressed",
    emptyMessage: "no pending rollouts",
  },
  validating: {
    name: "Validating",
    state: "in-progress",
    emptyMessage: "no validations running",
  },
  "rolling-out": {
    name: "Rolling out",
    state: "in-progress",
    emptyMessage: "no rollouts in flight",
  },
  "rolling-back": {
    name: "Rolling back",
    state: "firing",
    emptyMessage: "no active rollbacks",
  },
  complete: {
    name: "Complete",
    state: "resolved",
    emptyMessage: "no completed deployments yet",
  },
}

interface DeploymentKanbanProps {
  deployments: readonly BlueGreenDeployment[]
  onAdd?: () => void
}

export function DeploymentKanban({
  deployments,
  onAdd,
}: DeploymentKanbanProps) {
  const buckets = useMemo(() => {
    const result: Record<DeploymentColumn, BlueGreenDeployment[]> = {
      pending: [],
      validating: [],
      "rolling-out": [],
      "rolling-back": [],
      complete: [],
    }
    for (const dep of deployments) {
      result[deploymentColumn(dep.state)].push(dep)
    }
    return result
  }, [deployments])

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {COLUMN_ORDER.map((col) => {
        const meta = COLUMN_META[col]
        const items = buckets[col]
        return (
          <KanbanColumn
            key={col}
            state={meta.state}
            name={meta.name}
            count={items.length}
            emptyMessage={meta.emptyMessage}
            onAdd={onAdd}
          >
            {items.map((d) => (
              <DeploymentCard key={d.name} deployment={d} />
            ))}
          </KanbanColumn>
        )
      })}
    </div>
  )
}
