/** Placeholder for Hub routes that don't have full implementations yet.
 *
 *  Renders the Hub chrome with a breadcrumb + a "coming in PX" message.
 *  Used during the migration to ensure every sidebar destination resolves to
 *  a registered route, preventing dynamic routes (`$id`) from accidentally
 *  catching un-built siblings (which causes Flink REST 400s when the param
 *  reaches `fetchJobDetail`). */

import { HubBreadcrumb, type HubBreadcrumbCrumb } from "@flink-reactor/ui"
import { useRouterState } from "@tanstack/react-router"
import { ArrowRight, Construction } from "lucide-react"
import { HubAppShell } from "./hub-app-shell"
import { HubLink } from "./hub-link"

interface HubComingSoonProps {
  /** Breadcrumb crumbs leading to this route. The last crumb's `label` is
   *  used as the page title if `title` isn't provided. */
  crumbs: HubBreadcrumbCrumb[]
  /** Page title. Defaults to the last crumb's label. */
  title?: string
  /** Migration phase that ships this page (e.g., "P3"). */
  phase: "P2" | "P3" | "P4"
  /** Short description of what this page will do. */
  description: string
  /** Optional related route to link to. */
  relatedTo?: { label: string; to: string }
}

export function HubComingSoon({
  crumbs,
  title,
  phase,
  description,
  relatedTo,
}: HubComingSoonProps) {
  const heading = title ?? crumbs[crumbs.length - 1]?.label ?? "Coming soon"
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const legacyPath = pathname.replace("/hub", "") || "/overview"
  return (
    <HubAppShell>
      <HubBreadcrumb crumbs={crumbs} LinkComponent={HubLink} />
      <h1 className="mt-1 font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
        {heading}
      </h1>

      <div className="mt-8 glass-card-static p-8 text-center">
        <Construction className="mx-auto size-8 text-fr-coral" />
        <h2 className="mt-4 text-[14px] font-medium text-zinc-100">
          Wired in {phase}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[12px] text-fg-muted">
          {description}
        </p>
        <p className="mx-auto mt-4 max-w-md text-[10.5px] font-mono text-fg-faint">
          The legacy <code className="text-fg-muted">{legacyPath}</code> route
          still works during the migration window.
        </p>
        {relatedTo ? (
          <div className="mt-6">
            <HubLink
              to={relatedTo.to}
              className="inline-flex items-center gap-1.5 text-[12px] text-fr-coral hover:underline"
            >
              {relatedTo.label}
              <ArrowRight className="size-3" />
            </HubLink>
          </div>
        ) : null}
      </div>
    </HubAppShell>
  )
}
