"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "lime";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  /* Electric-lime CTA — main action */
  lime:
    "bg-electric-lime text-near-black border border-near-black hover:bg-[#ccf43a] font-medium",
  /* Near-black filled — secondary primary */
  primary:
    "bg-near-black text-white border border-near-black hover:bg-charcoal font-medium dark:bg-parchment-card dark:text-near-black dark:border-stone dark:hover:bg-stone",
  /* Parchment — tertiary */
  secondary:
    "bg-parchment-card text-near-black border border-stone hover:bg-stone",
  /* Ghost — outlined */
  ghost:
    "bg-transparent text-near-black border border-near-black hover:bg-warm-cream dark:text-white dark:border-white dark:hover:bg-charcoal",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-4 text-sm",
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
        "inline-flex items-center justify-center rounded-[26px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-lime/50 disabled:opacity-50 disabled:pointer-events-none",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}
