"use client";

import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  label,
  sublabel,
  className,
}: {
  value: number; // 0..1
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
          background: `conic-gradient(#10b981 ${deg}deg, rgba(148,163,184,0.25) 0deg)`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-[color:var(--background)] border border-slate-200/70 dark:border-slate-800/70 grid place-items-center text-center p-4">
          <div className="text-3xl font-semibold">{Math.round(pct * 100)}%</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {label}
          </div>
          {sublabel && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

