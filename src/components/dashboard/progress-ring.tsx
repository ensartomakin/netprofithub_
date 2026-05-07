"use client";

import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  label,
  sublabel,
  className,
}: {
  value: number;
  label: string;
  sublabel?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const deg = Math.round(pct * 360);

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className="relative h-44 w-44 rounded-full"
        style={{
          background: `conic-gradient(#d3fa99 ${deg}deg, #c4c7c4 0deg)`,
        }}
      >
        {/* Inner circle — white card surface floating over lime ring */}
        <div className="absolute inset-3 rounded-full bg-white grid place-items-center text-center p-4">
          <div className="text-3xl font-medium text-charcoal-text">{Math.round(pct * 100)}%</div>
          <div className="text-xs text-dark-overlay mt-1">{label}</div>
          {sublabel && <div className="text-[11px] text-dark-overlay mt-1">{sublabel}</div>}
        </div>
      </div>
    </div>
  );
}
