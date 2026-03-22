"use client"

import { cn } from "../../lib/cn"

type CardSize = "compact" | "default" | "lg"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: CardSize
}

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

function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="description" className={cn("text-xs text-zinc-500", className)} {...props} />
}

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
