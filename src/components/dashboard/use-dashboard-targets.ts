"use client";

import { useEffect, useMemo, useState } from "react";

export type DashboardTargets = {
  revenueTarget: number; // aylık ciro hedefi
  roiTarget: number; // ROI/ROAS hedefi
};

const defaults: DashboardTargets = {
  revenueTarget: 2_400_000,
  roiTarget: 10,
};

export function useDashboardTargets(storeId: string | null) {
  const key = useMemo(() => (storeId ? `nph_targets_${storeId}` : null), [storeId]);
  const [targets, setTargets] = useState<DashboardTargets>(() => {
    if (typeof window === "undefined") return defaults;
    if (!storeId) return defaults;
    try {
      const raw = localStorage.getItem(`nph_targets_${storeId}`);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<DashboardTargets>;
      return {
        revenueTarget:
          typeof parsed.revenueTarget === "number"
            ? parsed.revenueTarget
            : defaults.revenueTarget,
        roiTarget:
          typeof parsed.roiTarget === "number"
            ? parsed.roiTarget
            : defaults.roiTarget,
      };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(targets));
    } catch {
      // ignore
    }
  }, [key, targets]);

  return { targets, setTargets };
}
