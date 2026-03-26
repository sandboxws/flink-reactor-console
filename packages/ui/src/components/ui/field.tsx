/** Form field primitives — composable label, input area, description, and error message slots. */
"use client"

import { cn } from "../../lib/cn"

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Vertical stack container for a single form field. */
function Field({ className, ...props }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props} />
  )
}

/** Label element for the field input. */
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

/** Wrapper for the input element and related content. */
function FieldContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />
}

/** Muted helper text below the input. */
function FieldDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-fg-muted", className)} {...props} />
  )
}

/** Red error message below the input. */
function FieldError({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-red-400", className)} {...props} />
  )
}

interface FieldSetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {}

/** Grouped set of related fields (HTML fieldset). */
function FieldSet({ className, ...props }: FieldSetProps) {
  return (
    <fieldset
      className={cn("flex flex-col gap-4 border-0 p-0", className)}
      {...props}
    />
  )
}

/** Heading for a field set group. */
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
