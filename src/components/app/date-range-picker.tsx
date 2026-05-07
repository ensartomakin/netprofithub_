"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppState } from "@/components/app/app-state";
import { toLocalISODate } from "@/lib/date";

function toIsoDate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return toLocalISODate(x);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function DateRangePicker() {
  const { dateRange, setPreset, setCustomRange } = useAppState();
  const preset = dateRange.preset;
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => toIsoDate(dateRange.from));
  const [toInclusive, setToInclusive] = useState(() =>
    toIsoDate(new Date(dateRange.to.getTime() - 24 * 60 * 60 * 1000))
  );

  const label = useMemo(() => {
    switch (preset) {
      case "gunluk":
        return "Günlük";
      case "l7":
        return "L7";
      case "l30":
        return "L30";
      case "ozel":
        return `${toIsoDate(dateRange.from)} → ${toIsoDate(addDays(dateRange.to, -1))}`;
    }
  }, [dateRange.from, dateRange.to, preset]);

  const presets = [
    ["gunluk", "Günlük"],
    ["l7", "L7"],
    ["l30", "L30"],
    ["ozel", "Özel"],
  ] as const;

  return (
    <div className="flex items-center gap-3 relative">
      {/* Pill tab selector — TravelPerk style */}
      <div className="flex items-center rounded-[26px] bg-stone p-1 gap-0.5">
        {presets.map(([key, text], idx) => (
          <span key={key} className="flex items-center">
            <button
              onClick={() => {
                setPreset(key);
                if (key === "ozel") {
                  setFrom(toIsoDate(dateRange.from));
                  setToInclusive(toIsoDate(addDays(dateRange.to, -1)));
                  setOpen(true);
                }
              }}
              className={cn(
                "h-8 px-4 text-sm rounded-[26px] transition-colors font-medium",
                preset === key
                  ? "bg-forest-green text-snow-white"
                  : "text-charcoal-text hover:bg-white/50"
              )}
            >
              {text}
            </button>
            {idx < presets.length - 1 && preset !== key && preset !== presets[idx + 1]?.[0] && (
              <span className="h-4 w-px bg-charcoal-text/20 mx-0.5" />
            )}
          </span>
        ))}
      </div>

      {/* Özel date range dropdown */}
      {preset === "ozel" && open && (
        <div className="absolute right-0 top-12 z-20 w-[320px] rounded-[26px] border border-frosted-glass bg-snow-white p-5 shadow-sm">
          <div className="grid gap-4">
            <label className="block">
              <span className="text-xs text-dark-overlay mb-1.5 block">Başlangıç</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-dark-overlay mb-1.5 block">Bitiş</span>
              <Input
                type="date"
                value={toInclusive}
                onChange={(e) => setToInclusive(e.target.value)}
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                İptal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const f = new Date(`${from}T00:00:00`);
                  const t = new Date(`${toInclusive}T00:00:00`);
                  setCustomRange(f, t);
                  setOpen(false);
                }}
              >
                Uygula
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
