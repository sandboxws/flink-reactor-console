import { createFileRoute, Link } from "@tanstack/react-router"

function HomePage() {
  const sections = [
    {
      title: "Primitives",
      description: "20 Radix-based UI primitives",
      href: "/primitives",
      count: 20,
    },
    {
      title: "Shared",
      description: "15 reusable domain components",
      href: "/shared",
      count: 15,
    },
    {
      title: "Domain",
      description: "45 domain-specific components",
      href: "/domain",
      count: 45,
    },
    {
      title: "Templates",
      description: "17 page-level template compositions",
      href: "/templates",
      count: 17,
    },
    {
      title: "Scenarios",
      description: "Full cluster state views",
      href: "/scenarios",
      count: 4,
    },
  ]

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">@flink-reactor/ui</h1>
        <p className="mt-1 text-fg-muted">
          Design system for FlinkReactor — Gruvpuccin theme, Radix primitives,
          Tailwind v4
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            to={s.href}
            className="glass-card p-5 transition-all hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-fg">{s.title}</h2>
              <span className="rounded-full bg-fr-purple/20 px-2 py-0.5 text-xs font-medium text-fr-purple">
                {s.count}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export const Route = createFileRoute("/")({
  component: HomePage,
})
