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
        "h-10 w-full rounded-[26px] border border-stone bg-white px-4 text-sm text-near-black outline-none placeholder:text-graphite focus:border-near-black focus:ring-2 focus:ring-electric-lime/40 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
