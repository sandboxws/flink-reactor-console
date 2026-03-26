/** Generic list item component with media, content, and action slots. */
"use client"

import { cn } from "../../lib/cn"

type ItemVariant = "default" | "outline" | "muted"

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ItemVariant
}

const variantStyles: Record<ItemVariant, string> = {
  default: "bg-transparent",
  outline: "border border-dash-border rounded-lg",
  muted: "bg-white/[0.03] rounded-lg",
}

/** Horizontal layout with default/outline/muted variants. */
function Item({ className, variant = "default", ...props }: ItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

/** Fixed-width slot for icons or avatars. */
function ItemMedia({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center", className)}
      {...props}
    />
  )
}

/** Flexible text area with title and description. */
function ItemContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-0.5", className)} {...props} />
  )
}

/** Bold primary text within an item. */
function ItemTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm font-medium text-zinc-200", className)}
      {...props}
    />
  )
}

/** Muted secondary text within an item. */
function ItemDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-fg-muted", className)}
      {...props}
    />
  )
}

/** Right-aligned action buttons. */
function ItemActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ml-auto flex shrink-0 items-center gap-1", className)}
      {...props}
    />
  )
}

export { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions }
export type { ItemProps, ItemVariant }
