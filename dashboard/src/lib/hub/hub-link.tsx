/** TanStack Router adapter for HubShell's LinkComponent prop. */

import { Link } from "@tanstack/react-router"

interface HubLinkProps {
  to: string
  className?: string
  children: React.ReactNode
}

/** Adapter that lets the router-agnostic `@flink-reactor/ui` Hub primitives
 *  emit TanStack Router `<Link>`s. Without this the sidebar would do full
 *  page reloads, losing Zustand store state. */
export function HubLink({ to, className, children }: HubLinkProps) {
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  )
}
