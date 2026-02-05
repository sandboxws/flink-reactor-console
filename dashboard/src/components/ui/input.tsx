"use client";

import { cn } from "@/lib/cn";

function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-8 w-full rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-sm text-zinc-200 transition-colors placeholder:text-zinc-500 focus-visible:border-fr-purple focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
