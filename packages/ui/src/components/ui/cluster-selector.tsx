/** Top-bar cluster picker pill with environment-tinted leading badge. */
"use client"

import { ChevronDown } from "lucide-react"
import { forwardRef } from "react"

import { cn } from "../../lib/cn"

type ClusterEnv = "prod" | "stage" | "dev"

interface ClusterSelectorProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  env: ClusterEnv
  cluster: string
}

/** Inline button styled as a pill. The `env` badge tints rose/amber/teal for prod/stage/dev.
 *  Forwards ref so the component works as a Radix `asChild` target (e.g., as a Popover trigger). */
const ClusterSelector = forwardRef<HTMLButtonElement, ClusterSelectorProps>(
  function ClusterSelector(
    { env, cluster, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn("cluster-selector", className)}
        {...props}
      >
        <span className={cn("env", env)}>{env}</span>
        <span>{cluster}</span>
        <ChevronDown className="size-3 text-fg-faint" aria-hidden="true" />
      </button>
    )
  },
)

export type { ClusterEnv, ClusterSelectorProps }
export { ClusterSelector }
