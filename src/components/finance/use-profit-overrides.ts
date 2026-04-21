"use client";

import { useMemo, useSyncExternalStore } from "react";

export type ProfitOverrides = {
  shippingCostPerOrder: number;
  marketplaceFeeRate: number; // 0..1 (e.g. 0.12)
  returnCostRate: number; // 0..1 (e.g. 0.08) extra cost over refunded revenue
};

const DEFAULTS: ProfitOverrides = {
  shippingCostPerOrder: 35,
  marketplaceFeeRate: 0.12,
  returnCostRate: 0.06,
};

function keyFor(storeId: string) {
  return `nph_profit_overrides:${storeId}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(input: Partial<ProfitOverrides>): ProfitOverrides {
  const shippingCostPerOrder = Number(input.shippingCostPerOrder ?? DEFAULTS.shippingCostPerOrder);
  const marketplaceFeeRate = Number(input.marketplaceFeeRate ?? DEFAULTS.marketplaceFeeRate);
  const returnCostRate = Number(input.returnCostRate ?? DEFAULTS.returnCostRate);
  return {
    shippingCostPerOrder: Number.isFinite(shippingCostPerOrder) ? clamp(shippingCostPerOrder, 0, 1000) : DEFAULTS.shippingCostPerOrder,
    marketplaceFeeRate: Number.isFinite(marketplaceFeeRate) ? clamp(marketplaceFeeRate, 0, 0.5) : DEFAULTS.marketplaceFeeRate,
    returnCostRate: Number.isFinite(returnCostRate) ? clamp(returnCostRate, 0, 0.5) : DEFAULTS.returnCostRate,
  };
}

export function useProfitOverrides(storeId: string | null) {
  const subscribe = useMemo(() => {
    return (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      window.addEventListener("nph_profit_overrides", handler as EventListener);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("nph_profit_overrides", handler as EventListener);
      };
    };
  }, []);

  const getSnapshot = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return DEFAULTS;
      if (!storeId) return DEFAULTS;
      try {
        const raw = window.localStorage.getItem(keyFor(storeId));
        if (!raw) return DEFAULTS;
        const parsed = JSON.parse(raw) as Partial<ProfitOverrides>;
        return normalize(parsed);
      } catch {
        return DEFAULTS;
      }
    };
  }, [storeId]);

  const overrides = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);

  const api = useMemo(
    () => ({
      overrides,
      // Supabase persist en son aşamada eklenecek
      isRemoteEnabled: false,
      isSyncing: false,
      syncError: null as string | null,
      setOverrides: (patch: Partial<ProfitOverrides>) => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        const next = normalize({ ...overrides, ...patch });
        try {
          window.localStorage.setItem(keyFor(storeId), JSON.stringify(next));
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("nph_profit_overrides"));
      },
      reset: () => {
        if (typeof window === "undefined") return;
        if (!storeId) return;
        try {
          window.localStorage.setItem(keyFor(storeId), JSON.stringify(DEFAULTS));
        } catch {
          // ignore
        }
        window.dispatchEvent(new Event("nph_profit_overrides"));
      },
    }),
    [overrides, storeId]
  );

  return api;
}
