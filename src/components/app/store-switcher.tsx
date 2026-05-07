"use client";

import { useEffect, useMemo } from "react";
import { ChevronDown, Plus, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createDefaultStore, fetchStores } from "@/lib/queries/stores";
import { useAppState } from "@/components/app/app-state";
import { Button } from "@/components/ui/button";

export function StoreSwitcher() {
  const { storeId, setStoreId } = useAppState();
  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: fetchStores,
  });

  const stores = useMemo(() => storesQuery.data ?? [], [storesQuery.data]);
  const current = useMemo(
    () => stores.find((s) => s.id === storeId) ?? stores[0],
    [storeId, stores]
  );

  useEffect(() => {
    if (stores.length === 0) return;
    const valid = stores.some((s) => s.id === storeId);
    if (!valid) setStoreId(stores[0]!.id);
  }, [storeId, stores, setStoreId]);

  const today = new Date().toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Inline store selector */}
      <label className="relative inline-flex items-center gap-1.5">
        <Store className="h-3.5 w-3.5 text-dark-overlay" />
        <span className="text-sm text-dark-overlay">Mağaza:</span>
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value || null)}
          disabled={storesQuery.isLoading || stores.length === 0}
          className={cn(
            "appearance-none bg-transparent text-sm text-charcoal-text font-medium outline-none cursor-pointer pr-4",
          )}
          aria-label="Mağaza seç"
        >
          {storesQuery.isLoading && <option>Yükleniyor…</option>}
          {!storesQuery.isLoading && stores.length === 0 && (
            <option>Mağaza yok</option>
          )}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-dark-overlay" />
      </label>

      <span className="text-dark-overlay/50">•</span>
      <span className="text-sm text-dark-overlay">{today}</span>

      {stores.length === 0 && !storesQuery.isLoading && (
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const created = await createDefaultStore();
            storesQuery.refetch();
            setStoreId(created.id);
          }}
          className="gap-2 ml-2"
        >
          <Plus className="h-4 w-4" />
          Mağaza Oluştur
        </Button>
      )}
    </div>
  );
}
