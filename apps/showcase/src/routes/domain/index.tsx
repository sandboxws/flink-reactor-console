import { createFileRoute } from "@tanstack/react-router"

function DomainPage() {
  const domains = [
    { name: "Overview", count: 4 },
    { name: "Jobs", count: 13 },
    { name: "Logs", count: 4 },
    { name: "Errors", count: 2 },
    { name: "Monitoring", count: 4 },
    { name: "Insights", count: 5 },
    { name: "Plan Analyzer", count: 5 },
    { name: "Catalogs", count: 3 },
    { name: "Tap", count: 4 },
    { name: "Materialized Tables", count: 1 },
  ]

  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Domain Components</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map((d) => (
          <div key={d.name} className="glass-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-fg">{d.name}</h2>
              <span className="text-xs text-fg-muted">{d.count} components</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/domain/")({
  component: DomainPage,
})
