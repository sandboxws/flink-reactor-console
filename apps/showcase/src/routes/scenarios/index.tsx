import { createFileRoute, Link } from "@tanstack/react-router"

function ScenariosPage() {
  const scenarios = [
    {
      name: "Healthy Cluster",
      path: "/scenarios/healthy",
      description: "3 TMs, 2 running jobs, health score 92",
    },
    {
      name: "Degraded Cluster",
      path: "/scenarios/degraded",
      description: "Elevated backpressure, checkpoint delays",
    },
    {
      name: "Failing Cluster",
      path: "/scenarios/failing",
      description: "OOM failure, high memory, health score 35",
    },
    {
      name: "Empty Cluster",
      path: "/scenarios/empty",
      description: "Fresh cluster, no workload",
    },
  ]

  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Scenarios</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {scenarios.map((s) => (
          <Link key={s.path} to={s.path} className="glass-card p-5">
            <h2 className="text-lg font-medium text-fg">{s.name}</h2>
            <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/scenarios/")({
  component: ScenariosPage,
})
