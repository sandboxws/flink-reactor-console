/** Card container with composable header, content, and footer slots. */
"use client"

import { cn } from "../../lib/cn"

type CardSize = "compact" | "default" | "lg"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: CardSize
}

/** Bordered panel with compact/default/lg size presets. */
function Card({ className, size = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group rounded-lg border border-dash-border bg-dash-panel shadow-sm",
        className,
      )}
      {...props}
    />
  )
}

/** Top section with title and description spacing. */
function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="header"
      className={cn(
        "flex flex-col space-y-1.5 p-4 group-data-[size=compact]:p-3 group-data-[size=lg]:p-6",
        className,
      )}
      {...props}
    />
  )
}

/** Bold card heading. */
function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="title"
      className={cn(
        "text-sm font-semibold leading-none text-zinc-200",
        className,
      )}
      {...props}
    />
  )
}

/** Muted subtitle text below the card title. */
function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="description" className={cn("text-xs text-zinc-500", className)} {...props} />
}

/** Main body area of the card. */
function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="content"
      className={cn(
        "p-4 pt-0 group-data-[size=compact]:p-3 group-data-[size=compact]:pt-0 group-data-[size=lg]:p-6 group-data-[size=lg]:pt-0",
        className,
      )}
      {...props}
    />
  )
}

/** Bottom action bar. */
function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="footer"
      className={cn(
        "flex items-center p-4 pt-0 group-data-[size=compact]:p-3 group-data-[size=compact]:pt-0 group-data-[size=lg]:p-6 group-data-[size=lg]:pt-0",
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
export type { CardProps, CardSize }
