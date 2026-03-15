import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Play,
  Zap,
  Clock,
  GitFork,
  Split,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { SANDBOX_CATEGORIES, type SandboxCategory } from "./sandbox-examples"
import { useSandboxStore } from "@/stores/sandbox-store"

const CATEGORY_ICONS: Record<string, typeof Play> = {
  "getting-started": BookOpen,
  transforms: Zap,
  windows: Clock,
  joins: GitFork,
  routing: Split,
}

export function SandboxSidebar() {
  const activeExample = useSandboxStore((s) => s.activeExample)
  const loadExample = useSandboxStore((s) => s.loadExample)
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(SANDBOX_CATEGORIES.map((c) => c.id)),
  )

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Examples
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {SANDBOX_CATEGORIES.map((category) => (
            <CategoryGroup
              key={category.id}
              category={category}
              isExpanded={expanded.has(category.id)}
              activeExampleId={activeExample}
              onToggle={() => toggle(category.id)}
              onSelect={loadExample}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}

function CategoryGroup({
  category,
  isExpanded,
  activeExampleId,
  onToggle,
  onSelect,
}: {
  category: SandboxCategory
  isExpanded: boolean
  activeExampleId: string | null
  onToggle: () => void
  onSelect: (id: string) => void
}) {
  const Icon = CATEGORY_ICONS[category.id] ?? Play

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.04]"
      >
        {isExpanded ? (
          <ChevronDown className="size-3 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-zinc-500" />
        )}
        <Icon className="size-3.5 shrink-0 text-zinc-500" />
        <span>{category.name}</span>
      </button>

      {isExpanded && (
        <div className="ml-3 border-l border-dash-border">
          {category.examples.map((example) => {
            const isActive = activeExampleId === example.id
            return (
              <button
                key={example.id}
                type="button"
                onClick={() => onSelect(example.id)}
                title={example.description}
                className={cn(
                  "flex w-full items-center gap-2 rounded-r-md border-l-2 px-3 py-1.5 text-left text-[11px] transition-colors",
                  isActive
                    ? "border-fr-purple bg-fr-purple/10 text-zinc-100"
                    : "border-transparent text-zinc-400 hover:border-zinc-600 hover:bg-white/[0.03] hover:text-zinc-300",
                )}
              >
                <Play
                  className={cn(
                    "size-3 shrink-0",
                    isActive ? "text-fr-purple" : "text-zinc-600",
                  )}
                />
                <span className="truncate">{example.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
