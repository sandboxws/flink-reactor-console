import {
  createRootRoute,
  type ErrorComponentProps,
  Outlet,
  useLocation,
} from "@tanstack/react-router"
import { AlertTriangle } from "lucide-react"
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

  // Hub routes own their layout (HubShell). Skip the legacy Shell here so
  // /hub/* renders inside its own top bar + sidebar, not the legacy chrome.
  if (pathname === "/hub" || pathname.startsWith("/hub/")) {
    return <Outlet />
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  )
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : ""
  const isHub = pathname === "/hub" || pathname.startsWith("/hub/")
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred"

  const content = (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="glass-card-static max-w-md p-8 text-center">
        <AlertTriangle className="mx-auto mb-4 size-8 text-fr-rose" />
        <h2 className="mb-2 font-sans text-[16px] font-medium text-zinc-100">
          Something went wrong
        </h2>
        <p className="mb-6 text-[12px] font-mono text-fg-muted break-words">
          {message}
        </p>
        <button
          type="button"
          onClick={reset}
          className="btn btn-secondary btn-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )

  if (isHub) return content

  return <Shell>{content}</Shell>
}

/** Route: __root — Root layout with Shell wrapper, dynamic document title, and Outlet for child routes. */
export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
})
