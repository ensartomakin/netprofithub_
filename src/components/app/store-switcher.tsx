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
    if (!storeId && stores.length > 0) setStoreId(stores[0]!.id);
  }, [storeId, stores, setStoreId]);

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-slate-500 dark:text-slate-400 mr-2" />
      <label className="relative inline-flex items-center">
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(e.target.value || null)}
          disabled={storesQuery.isLoading || stores.length === 0}
          className={cn(
            "h-9 rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur px-3 pr-9 text-sm text-slate-900 dark:text-slate-100 outline-none",
            "focus:ring-2 focus:ring-slate-400/30"
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
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-500 dark:text-slate-400" />
        <span className="sr-only">{current?.name ?? "Mağaza"}</span>
      </label>

      {stores.length === 0 && !storesQuery.isLoading && (
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            const created = await createDefaultStore();
            storesQuery.refetch();
            setStoreId(created.id);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Mağaza Oluştur
        </Button>
      )}
    </div>
  );
}
