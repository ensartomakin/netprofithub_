import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger";

/* Seed: pill shape (1188px ≈ rounded-full), pale-green default */
const variantClass: Record<Variant, string> = {
  default:
    "bg-pale-green text-forest-green",
  success:
    "bg-[#1dc479]/15 text-[#1dc479]",
  warning:
    "bg-[#e8a020]/12 text-[#b07010]",
  danger:
    "bg-[#eb3131]/10 text-[#eb3131]",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-[0.04em]",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}
