import { createFileRoute, Link } from "@tanstack/react-router"

const TEMPLATES = [
  {
    name: "Overview",
    path: "/templates/overview",
    demos: 1,
    description: "Cluster overview dashboard",
  },
  {
    name: "Jobs",
    path: "/templates/jobs",
    demos: 5,
    description: "Job table, detail, graph, checkpoints, exceptions",
  },
  {
    name: "Logs",
    path: "/templates/logs",
    demos: 1,
    description: "Log explorer with filtering",
  },
  {
    name: "Errors",
    path: "/templates/errors",
    demos: 1,
    description: "Error explorer with timeline",
  },
  {
    name: "Monitoring",
    path: "/templates/monitoring",
    demos: 2,
    description: "Alerts and checkpoint analytics",
  },
  {
    name: "Insights",
    path: "/templates/insights",
    demos: 2,
    description: "Health dashboard and bottleneck analysis",
  },
  {
    name: "Task Managers",
    path: "/templates/task-managers",
    demos: 1,
    description: "Task manager list",
  },
  {
    name: "Job Manager",
    path: "/templates/job-manager",
    demos: 1,
    description: "Job manager detail view",
  },
  {
    name: "Deployments",
    path: "/templates/deployments",
    demos: 1,
    description: "Deployment management",
  },
  {
    name: "Plan Analyzer",
    path: "/templates/plan-analyzer",
    demos: 1,
    description: "Query plan analysis",
  },
  {
    name: "Catalogs",
    path: "/templates/catalogs",
    demos: 1,
    description: "Catalog browser",
  },
  {
    name: "Materialized Tables",
    path: "/templates/materialized-tables",
    demos: 1,
    description: "Materialized table management",
  },
]

function TemplatesPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Templates</h1>
      <p className="text-fg-muted">
        17 page-level compositions with fixture data
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className="glass-card p-5 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-fg">{t.name}</h2>
              <span className="rounded-full bg-fr-purple/20 px-2 py-0.5 text-xs font-medium text-fr-purple">
                {t.demos}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/templates/")({
  component: TemplatesPage,
})
