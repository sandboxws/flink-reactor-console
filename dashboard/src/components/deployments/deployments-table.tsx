import { Link } from "@tanstack/react-router"
import type { BlueGreenDeployment } from "@flink-reactor/ui"
import { StateBadge } from "./state-badge"

interface DeploymentsTableProps {
  deployments: BlueGreenDeployment[]
}

export function DeploymentsTable({ deployments }: DeploymentsTableProps) {
  if (deployments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <p className="text-sm">No blue-green deployments found</p>
        <p className="mt-1 text-xs">
          Configure Kubernetes access to monitor FlinkBlueGreenDeployment
          resources
        </p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-dash-border text-left text-xs uppercase tracking-wider text-zinc-500">
          <th className="px-4 py-2 font-medium">Name</th>
          <th className="px-4 py-2 font-medium">Namespace</th>
          <th className="px-4 py-2 font-medium">State</th>
          <th className="px-4 py-2 font-medium">Active Job</th>
          <th className="px-4 py-2 font-medium">Last Updated</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {deployments.map((d) => (
          <tr
            key={`${d.namespace}/${d.name}`}
            className="transition-colors hover:bg-dash-surface/50"
          >
            <td className="px-4 py-2.5">
              <Link
                to={`/deployments/${d.name}`}
                className="font-medium text-zinc-200 hover:text-fr-coral transition-colors"
              >
                {d.name}
              </Link>
            </td>
            <td className="px-4 py-2.5 text-zinc-400">{d.namespace}</td>
            <td className="px-4 py-2.5">
              <StateBadge state={d.state} />
            </td>
            <td className="px-4 py-2.5">
              {d.activeJobId ? (
                <Link
                  to={`/jobs/${d.activeJobId}`}
                  className="font-mono text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {d.activeJobId.slice(0, 12)}...
                </Link>
              ) : (
                <span className="text-zinc-600">-</span>
              )}
            </td>
            <td className="px-4 py-2.5 text-xs text-zinc-500">
              {d.lastReconciledTimestamp ?? "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
