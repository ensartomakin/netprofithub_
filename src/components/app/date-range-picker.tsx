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

  return (
    <div className="flex items-center gap-2 relative">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Tarih Aralığı
      </span>
      <div className="flex rounded-md border border-slate-200/70 dark:border-slate-800/70 p-1 bg-white/40 dark:bg-slate-950/30 backdrop-blur">
        {(
          [
            ["gunluk", "Günlük"],
            ["l7", "L7"],
            ["l30", "L30"],
            ["ozel", "Özel"],
          ] as const
        ).map(([key, text]) => (
          <Button
            key={key}
            size="sm"
            variant="ghost"
            onClick={() => {
              setPreset(key);
              if (key === "ozel") {
                setFrom(toIsoDate(dateRange.from));
                setToInclusive(toIsoDate(addDays(dateRange.to, -1)));
                setOpen(true);
              }
            }}
            className={cn(
              "h-7 px-2.5 text-xs",
              preset === key &&
                "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950"
            )}
          >
            {text}
          </Button>
        ))}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>

      {preset === "ozel" && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 px-2.5 text-xs"
          onClick={() => {
            if (!open) {
              setFrom(toIsoDate(dateRange.from));
              setToInclusive(toIsoDate(addDays(dateRange.to, -1)));
            }
            setOpen((v) => !v);
          }}
        >
          Aralık Seç
        </Button>
      )}

      {preset === "ozel" && open && (
        <div className="absolute right-0 top-10 z-20 w-[320px] rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/90 dark:bg-slate-950/80 backdrop-blur p-3 shadow-lg">
          <div className="grid gap-3">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">Başlangıç</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">Bitiş</span>
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

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Not: Bitiş tarihi dahildir. (Sorgular `to` değerini exclusive kullanır.)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
