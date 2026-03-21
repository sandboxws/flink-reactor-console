import { createFileRoute, Link } from "@tanstack/react-router"

const DOMAINS = [
  {
    name: "Overview",
    path: "/domain/overview",
    count: 4,
    description: "Cluster stats and status",
  },
  {
    name: "Jobs",
    path: "/domain/jobs",
    count: 13,
    description: "Job tables, graphs, detail tabs",
  },
  {
    name: "Logs",
    path: "/domain/logs",
    count: 4,
    description: "Log viewer components",
  },
  {
    name: "Errors",
    path: "/domain/errors",
    count: 2,
    description: "Error detail and timeline",
  },
  {
    name: "Monitoring",
    path: "/domain/monitoring",
    count: 4,
    description: "Alerts and checkpoints",
  },
  {
    name: "Insights",
    path: "/domain/insights",
    count: 5,
    description: "Health trends and bottlenecks",
  },
  {
    name: "Plan Analyzer",
    path: "/domain/plan-analyzer",
    count: 5,
    description: "Query plan visualization",
  },
  {
    name: "Catalogs",
    path: "/domain/catalogs",
    count: 3,
    description: "Schema and SQL browsing",
  },
  {
    name: "Tap",
    path: "/domain/tap",
    count: 4,
    description: "Live data tapping",
  },
  {
    name: "Materialized Tables",
    path: "/domain/materialized-tables",
    count: 1,
    description: "Materialized views",
  },
]

function DomainPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Domain Components</h1>
      <p className="text-fg-muted">
        45 domain-specific components across 10 feature areas
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((d) => (
          <Link
            key={d.path}
            to={d.path}
            className="glass-card p-5 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-fg">{d.name}</h2>
              <span className="rounded-full bg-fr-purple/20 px-2 py-0.5 text-xs font-medium text-fr-purple">
                {d.count}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{d.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/domain/")({ component: DomainPage })
