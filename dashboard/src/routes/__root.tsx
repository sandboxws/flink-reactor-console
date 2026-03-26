import { createRootRoute, Outlet, useLocation } from "@tanstack/react-router"
import { useEffect } from "react"
import { Shell } from "@/components/layout/shell"
import "../global.css"

const ID_PATTERN = /^[0-9a-f]{12,}$/i

function titleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "FlinkReactor"

  const labels = segments.map((s) => {
    if (ID_PATTERN.test(s)) {
      return `${s.slice(0, 8)}\u2026`
    }
    return s
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  })

  return `${labels.join(" \u203a ")} \u2014 FlinkReactor`
}

function RootComponent() {
  const pathname = useLocation({ select: (l) => l.pathname })

  useEffect(() => {
    document.title = titleFromPath(pathname)
  }, [pathname])

  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

/** Route: __root — Root layout with Shell wrapper, dynamic document title, and Outlet for child routes. */
export const Route = createRootRoute({
  component: RootComponent,
})
