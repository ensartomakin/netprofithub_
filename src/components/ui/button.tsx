"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  /* Electric-lime CTA — 26px radius pill */
  primary:
    "bg-pale-green text-forest-green border border-forest-green hover:brightness-95 font-medium",
  /* Same lime CTA */
  accent:
    "bg-pale-green text-forest-green border border-forest-green hover:brightness-95 font-medium",
  /* Parchment secondary */
  secondary:
    "bg-warm-gray text-charcoal-text border border-frosted-glass hover:bg-frosted-glass/70",
  /* Ghost — transparent bg, near-black border/text */
  ghost:
    "bg-transparent text-charcoal-text border border-forest-green hover:bg-warm-gray",
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
        "inline-flex items-center justify-center rounded-[26px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-green/40 disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}
