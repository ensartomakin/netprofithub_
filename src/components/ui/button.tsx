"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  /* Forest Green filled CTA — pill shape */
  primary:
    "bg-forest-green text-snow-white hover:opacity-90 font-medium",
  /* Pale-green accent — pill shape, max 2 per viewport */
  accent:
    "bg-pale-green text-forest-green hover:brightness-95 font-medium",
  /* Warm-gray secondary */
  secondary:
    "bg-warm-gray text-charcoal-text border border-frosted-glass hover:bg-frosted-glass",
  /* Ghost pill — snow-white bg, forest-green border/text */
  ghost:
    "bg-transparent text-charcoal-text border border-frosted-glass hover:bg-warm-gray",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-4 text-[13px]",
  md: "h-10 px-5 text-sm",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/40 disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}
