"use client"

import { cn } from "../../lib/cn"

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {}

function Field({ className, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props} />
  )
}

function FieldLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-zinc-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  )
}

function FieldContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

function FieldDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-fg-muted", className)} {...props} />
  )
}

function FieldError({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-red-400", className)} {...props} />
  )
}

interface FieldSetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {}

function FieldSet({ className, ...props }: FieldSetProps) {
  return (
    <fieldset
      className={cn("flex flex-col gap-4 border-0 p-0", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  ...props
}: React.HTMLAttributes<HTMLLegendElement>) {
  return (
    <legend
      className={cn("text-sm font-semibold text-zinc-200", className)}
      {...props}
    />
  )
}

export {
  Field,
  FieldLabel,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
}
export type { FieldProps, FieldSetProps }
