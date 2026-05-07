import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger";

/* Text Badge / Status Chip — 8px radius, white bg, warm palette */
const variantClass: Record<Variant, string> = {
  default:
    "bg-parchment-card text-near-black",
  success:
    "bg-[#1dc479]/12 text-[#1dc479]",
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
        "inline-flex items-center rounded-[8px] px-2.5 py-0.5 text-xs font-medium tracking-[0.06em]",
        variantClass[variant],
        className
      )}
      {...props}
    />
  );
}
