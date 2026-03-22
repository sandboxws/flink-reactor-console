import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/cn"

interface SortIconProps {
  column: string
  active: string
  direction: string
  className?: string
}

export function SortIcon({ column, active, direction, className }: SortIconProps) {
  const iconClass = cn("size-3", className)
  if (column !== active)
    return <ArrowUpDown className={cn(iconClass, "opacity-0 group-hover:opacity-50")} />
  return direction.toLowerCase() === "asc" ? (
    <ArrowUp className={iconClass} />
  ) : (
    <ArrowDown className={iconClass} />
  )
}
