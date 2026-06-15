"use client";

import { forwardRef } from "react";
import { cn } from "@/src/lib/utils";

const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border bg-transparent hover:bg-[hsl(var(--muted))]",
  ghost: "bg-transparent hover:bg-[hsl(var(--muted))]",
  destructive: "bg-red-600 text-white hover:bg-red-700",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
