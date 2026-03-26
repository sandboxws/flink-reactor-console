/** Alert banner component with default and destructive variants. */
"use client"

import { cn } from "../../lib/cn"

type AlertVariant = "default" | "destructive"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

const variantStyles: Record<AlertVariant, string> = {
  default: "border-dash-border text-zinc-300",
  destructive: "border-red-500/30 text-red-400",
}

/** Alert container with variant-driven border and text colors. */
function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border bg-dash-panel p-4 text-sm",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

/** Bold heading within an alert. */
function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

/** Body text within an alert. */
function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm opacity-80", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
export type { AlertVariant }
