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
          background: `conic-gradient(#beff50 ${deg}deg, #d2d2c8 0deg)`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-[color:var(--card)] border border-stone grid place-items-center text-center p-4">
          <div className="text-3xl font-medium text-near-black">
            {Math.round(pct * 100)}%
          </div>
          <div className="text-xs text-graphite mt-1">{label}</div>
          {sublabel && (
            <div className="text-[11px] text-graphite mt-1">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}
