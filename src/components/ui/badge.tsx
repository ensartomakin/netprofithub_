import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger";

const variantClass: Record<Variant, string> = {
  default:
    "bg-white text-near-black border-stone dark:bg-charcoal dark:text-white dark:border-charcoal",
  success:
    "bg-[#1dc479]/10 text-[#1dc479] border-[#1dc479]/30",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40",
  danger:
    "bg-[#eb3131]/10 text-[#eb3131] border-[#eb3131]/30",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[8px] border px-2.5 py-0.5 text-xs font-medium",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}
