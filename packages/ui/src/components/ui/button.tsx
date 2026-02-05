"use client";

import { cn } from "../../lib/cn";

type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-fr-purple text-white hover:bg-fr-purple/90",
  secondary: "bg-white/10 text-zinc-200 hover:bg-white/15",
  destructive: "bg-red-500/15 text-red-400 hover:bg-red-500/25",
  outline:
    "border border-dash-border bg-transparent text-zinc-300 hover:bg-white/5",
  ghost: "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
  link: "text-fr-purple underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-8 px-3 py-1.5",
  sm: "h-7 rounded-md px-2.5 text-xs",
  lg: "h-10 rounded-md px-6",
  icon: "size-8",
};

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
