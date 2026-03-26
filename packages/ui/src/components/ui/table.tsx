/** Table primitives -- composable header, body, row, and cell elements with dashboard styling. */
"use client"

import { cn } from "../../lib/cn"

/** Scrollable table container. */
function Table({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

/** Table head section with bottom border on rows. */
function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("[&_tr]:border-b [&_tr]:border-dash-border", className)}
      {...props}
    />
  )
}

/** Table body section. */
function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )
}

/** Table foot section with background tint. */
function TableFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "border-t border-dash-border bg-dash-panel/50 font-medium",
        className,
      )}
      {...props}
    />
  )
}

/** Table row with bottom border and transition colors. */
function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-dash-border transition-colors data-row",
        className,
      )}
      {...props}
    />
  )
}

/** Column header cell with compact sizing and muted text. */
function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium text-zinc-500 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

/** Standard data cell. */
function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "px-3 py-2 align-middle text-sm text-zinc-300 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  )
}

/** Muted caption below the table. */
function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("mt-4 text-sm text-zinc-500", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
}
