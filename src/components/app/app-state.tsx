"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toLocalISODate } from "@/lib/date";

export type DatePreset = "gunluk" | "l7" | "l30" | "ozel";

export type DateRangeState = {
  preset: DatePreset;
  from: Date;
  to: Date; // exclusive
};

type AppState = {
  storeId: string | null;
  setStoreId: (storeId: string | null) => void;
  dateRange: DateRangeState;
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (from: Date, toInclusive: Date) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function toIsoDate(d: Date) {
  return toLocalISODate(startOfDay(d));
}

function fromIsoDate(value: string) {
  // value: YYYY-MM-DD (local date)
  const [y, m, d] = value.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function loadCustomRange(): { from: Date; toInclusive: Date } | null {
  if (typeof window === "undefined") return null;
  try {
    const fromRaw = localStorage.getItem("nph_custom_from");
    const toRaw = localStorage.getItem("nph_custom_to");
    if (!fromRaw || !toRaw) return null;
    const from = fromIsoDate(fromRaw);
    const toInclusive = fromIsoDate(toRaw);
    if (!from || !toInclusive) return null;
    return { from, toInclusive };
  } catch {
    return null;
  }
}

function presetToRange(preset: DatePreset) {
  const today = startOfDay(new Date());
  switch (preset) {
    case "gunluk": {
      return { preset, from: today, to: addDays(today, 1) };
    }
    case "l7": {
      const to = addDays(today, 1);
      return { preset, from: addDays(to, -7), to };
    }
    case "l30": {
      const to = addDays(today, 1);
      return { preset, from: addDays(to, -30), to };
    }
    case "ozel": {
      const custom = loadCustomRange();
      if (custom) {
        const from = custom.from;
        const to = addDays(custom.toInclusive, 1); // exclusive
        return { preset, from, to };
      }
      // fallback: L30
      const to = addDays(today, 1);
      return { preset, from: addDays(to, -30), to };
    }
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(() => {
    try {
      if (typeof window === "undefined") return null;

      return localStorage.getItem("nph_store_id");
    } catch {
      return null;
    }
  });

  const [dateRange, setDateRange] = useState<DateRangeState>(() => {
    try {
      if (typeof window === "undefined") return presetToRange("l7");
      const savedPreset = localStorage.getItem("nph_date_preset") as
        | DatePreset
        | null;
      return presetToRange(savedPreset ?? "l7");
    } catch {
      return presetToRange("l7");
    }
  });

  useEffect(() => {
    try {
      if (storeId) localStorage.setItem("nph_store_id", storeId);
      else localStorage.removeItem("nph_store_id");
    } catch {
      // ignore
    }
  }, [storeId]);

  useEffect(() => {
    try {
      localStorage.setItem("nph_date_preset", dateRange.preset);
    } catch {
      // ignore
    }
  }, [dateRange.preset]);

  const value = useMemo<AppState>(
    () => ({
      storeId,
      setStoreId,
      dateRange,
      setPreset: (preset) => setDateRange(presetToRange(preset)),
      setCustomRange: (from: Date, toInclusive: Date) => {
        const f = startOfDay(from);
        const t = startOfDay(toInclusive);
        const fromSafe = f <= t ? f : t;
        const toInclusiveSafe = f <= t ? t : f;
        const to = addDays(toInclusiveSafe, 1); // exclusive

        try {
          localStorage.setItem("nph_custom_from", toIsoDate(fromSafe));
          localStorage.setItem("nph_custom_to", toIsoDate(toInclusiveSafe));
          localStorage.setItem("nph_date_preset", "ozel");
        } catch {
          // ignore
        }

        setDateRange({ preset: "ozel", from: fromSafe, to });
      },
    }),
    [dateRange, storeId]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState AppStateProvider dışında kullanıldı.");
  return ctx;
}
