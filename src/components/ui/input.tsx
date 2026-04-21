"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/30 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-400/30 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

