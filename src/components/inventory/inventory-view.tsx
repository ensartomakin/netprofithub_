"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { fetchProducts } from "@/lib/queries/products";
import { calculateDIR } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadCsv, toCsv } from "@/lib/csv";

function dirLabel(dir: number | null) {
  if (dir == null) return "—";
  if (!Number.isFinite(dir)) return "—";
  return `${Math.round(dir)} gün`;
}

type InventoryPolicy = {
  leadTimeDays: number; // tedarik süresi
  safetyDays: number; // güvenlik stoğu
  targetCoverageDays: number; // hedef kapsama
  reorderThresholdDays: number; // reorder eşiği
  overstockThresholdDays: number; // liquidation eşiği
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function defaultPolicy(): InventoryPolicy {
  return {
    leadTimeDays: 14,
    safetyDays: 7,
    targetCoverageDays: 30,
    reorderThresholdDays: 14,
    overstockThresholdDays: 90,
  };
}

function loadPolicy(storeId: string | null) {
  const defaults = defaultPolicy();
  if (typeof window === "undefined") return defaults;
  if (!storeId) return defaults;
  try {
    const raw = window.localStorage.getItem(`nph_inventory_policy:${storeId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<InventoryPolicy>;
    return {
      leadTimeDays: clampInt(parsed.leadTimeDays, defaults.leadTimeDays, 0, 120),
      safetyDays: clampInt(parsed.safetyDays, defaults.safetyDays, 0, 120),
      targetCoverageDays: clampInt(parsed.targetCoverageDays, defaults.targetCoverageDays, 1, 180),
      reorderThresholdDays: clampInt(
        parsed.reorderThresholdDays,
        defaults.reorderThresholdDays,
        1,
        60
      ),
      overstockThresholdDays: clampInt(
        parsed.overstockThresholdDays,
        defaults.overstockThresholdDays,
        30,
        365
      ),
    } satisfies InventoryPolicy;
  } catch {
    return defaults;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function InventoryView() {
  const { storeId } = useAppState();
  const [filter, setFilter] = useState<
    "all" | "critical" | "reorder" | "overstock" | "dnr"
  >("all");
  const [q, setQ] = useState("");
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [draftByStore, setDraftByStore] = useState<Record<string, InventoryPolicy>>({});

  const productsQuery = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => fetchProducts({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const policy = loadPolicy(storeId);
  const draft = storeId ? draftByStore[storeId] : undefined;
  const effectivePolicy = editingPolicy && draft ? draft : policy;

  const enriched = useMemo(() => {
    const rows = productsQuery.data ?? [];
    return rows.map((p) => {
      const stock = Number(p.stock_level ?? 0);
      const velocity = Number(p.velocity ?? 0);
      const dir = calculateDIR(stock, velocity);

      const overStock = dir != null && dir >= effectivePolicy.overstockThresholdDays;
      const critical = stock <= 0 || (dir != null && dir <= 7);
      const reorder =
        !p.dnr &&
        (stock <= 0 || (dir != null && dir <= effectivePolicy.reorderThresholdDays));

      const horizonDays =
        effectivePolicy.leadTimeDays +
        effectivePolicy.safetyDays +
        effectivePolicy.targetCoverageDays;
      const targetUnits = Math.max(0, velocity) * horizonDays;
      const recommendedUnits = reorder ? Math.max(0, Math.ceil(targetUnits - stock)) : null;

      const action: "critical" | "reorder" | "overstock" | "dnr" | "ok" =
        p.dnr ? "dnr" : critical ? "critical" : overStock ? "overstock" : reorder ? "reorder" : "ok";

      return { p, dir, overStock, critical, reorder, recommendedUnits, action };
    });
  }, [
    effectivePolicy.leadTimeDays,
    effectivePolicy.overstockThresholdDays,
    effectivePolicy.reorderThresholdDays,
    effectivePolicy.safetyDays,
    productsQuery.data,
    effectivePolicy.targetCoverageDays,
  ]);

  const criticalCount = enriched.filter((x) => x.critical).length;
  const overStockCount = enriched.filter((x) => x.overStock).length;
  const dnrCount = enriched.filter((x) => x.p.dnr).length;
  const reorderCount = enriched.filter((x) => x.reorder).length;

  const reorderPlan = useMemo(() => {
    const rows = enriched
      .filter((x) => x.recommendedUnits != null && x.recommendedUnits > 0 && !x.p.dnr)
      .sort((a, b) => (b.recommendedUnits ?? 0) - (a.recommendedUnits ?? 0))
      .slice(0, 20);

    const eta = new Date();
    eta.setDate(eta.getDate() + effectivePolicy.leadTimeDays);
    const etaLabel = new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
    }).format(eta);

    return {
      etaLabel,
      rows,
      totalUnits: rows.reduce((acc, r) => acc + Number(r.recommendedUnits ?? 0), 0),
    };
  }, [effectivePolicy.leadTimeDays, enriched]);

  const liquidationPlan = useMemo(() => {
    const rows = enriched
      .filter((x) => x.action === "overstock" && !x.p.dnr)
      .map((x) => {
        const stock = Number(x.p.stock_level ?? 0);
        const velocity = Number(x.p.velocity ?? 0);
        const dir = x.dir;

        const targetUnits = Math.max(0, velocity) * effectivePolicy.targetCoverageDays;
        const excessUnits =
          velocity <= 0 ? stock : Math.max(0, Math.ceil(stock - targetUnits));

        const threshold = effectivePolicy.overstockThresholdDays;
        const ratio = dir == null || !Number.isFinite(dir) ? 0 : (dir - threshold) / threshold;
        const base = clamp(10 + ratio * 20, 10, 35);
        const minPct = Math.round(clamp(base - 5, 5, 40));
        const maxPct = Math.round(clamp(base + 5, 10, 50));

        return {
          sku: String(x.p.sku),
          name: String(x.p.name),
          dir: x.dir,
          stock,
          velocity,
          excessUnits,
          discountRange: `${minPct}–${maxPct}%`,
          kind: dir != null && dir >= threshold * 1.3 ? "agresif" : "kademeli",
        };
      })
      .sort((a, b) => (b.excessUnits ?? 0) - (a.excessUnits ?? 0))
      .slice(0, 20);

    const totalExcess = rows.reduce((acc, r) => acc + Number(r.excessUnits ?? 0), 0);
    return { rows, totalExcess };
  }, [effectivePolicy.overstockThresholdDays, effectivePolicy.targetCoverageDays, enriched]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return enriched
      .filter((x) => {
        if (filter === "all") return true;
        if (filter === "critical") return x.action === "critical";
        if (filter === "reorder") return x.action === "reorder";
        if (filter === "overstock") return x.action === "overstock";
        if (filter === "dnr") return x.action === "dnr";
        return true;
      })
      .filter((x) => {
        if (!query) return true;
        return (
          String(x.p.sku ?? "").toLowerCase().includes(query) ||
          String(x.p.name ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aScore =
          a.action === "critical"
            ? 4
            : a.action === "reorder"
              ? 3
              : a.action === "overstock"
                ? 2
                : a.action === "dnr"
                  ? 1
                  : 0;
        const bScore =
          b.action === "critical"
            ? 4
            : b.action === "reorder"
              ? 3
              : b.action === "overstock"
                ? 2
                : b.action === "dnr"
                  ? 1
                  : 0;
        if (aScore !== bScore) return bScore - aScore;
        return String(a.p.sku).localeCompare(String(b.p.sku));
      });
  }, [enriched, filter, q]);

  if (!storeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Başlamak için</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-300">
          Üst bardan bir mağaza seçin veya “Mağaza Oluştur” ile ilk mağazanızı
          oluşturun.
        </CardContent>
      </Card>
    );
  }

  if (productsQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Ürünler yükleniyor…
      </div>
    );
  }

  if (productsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Ürünler alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Stok Zekâsı</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!storeId) return;
                const nextOpen = !editingPolicy;
                if (nextOpen) {
                  setDraftByStore((prev) => {
                    if (prev[storeId]) return prev;
                    return { ...prev, [storeId]: policy };
                  });
                }
                setEditingPolicy(nextOpen);
              }}
            >
              {editingPolicy ? "Kapat" : "Politika"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            DIR (Days of Inventory Remaining) = Stok / Ortalama Günlük Satış
            (Velocity). DNR işaretli ürünler için yeniden sipariş önerilmez.
          </div>

          {editingPolicy && (
            <div className="mt-4 rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
              <div className="grid gap-3 md:grid-cols-5 items-end">
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Lead Time (gün)</span>
                  <Input
                    type="number"
                    value={(draft ?? policy).leadTimeDays}
                    onChange={(e) => {
                      if (!storeId) return;
                      const next = clampInt(e.target.value, 14, 0, 120);
                      setDraftByStore((prev) => ({
                        ...prev,
                        [storeId]: { ...(prev[storeId] ?? policy), leadTimeDays: next },
                      }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Güvenlik (gün)</span>
                  <Input
                    type="number"
                    value={(draft ?? policy).safetyDays}
                    onChange={(e) => {
                      if (!storeId) return;
                      const next = clampInt(e.target.value, 7, 0, 120);
                      setDraftByStore((prev) => ({
                        ...prev,
                        [storeId]: { ...(prev[storeId] ?? policy), safetyDays: next },
                      }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Hedef Kapsama (gün)</span>
                  <Input
                    type="number"
                    value={(draft ?? policy).targetCoverageDays}
                    onChange={(e) => {
                      if (!storeId) return;
                      const next = clampInt(e.target.value, 30, 1, 180);
                      setDraftByStore((prev) => ({
                        ...prev,
                        [storeId]: { ...(prev[storeId] ?? policy), targetCoverageDays: next },
                      }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Reorder Eşiği (DIR)</span>
                  <Input
                    type="number"
                    value={(draft ?? policy).reorderThresholdDays}
                    onChange={(e) => {
                      if (!storeId) return;
                      const next = clampInt(e.target.value, 14, 1, 60);
                      setDraftByStore((prev) => ({
                        ...prev,
                        [storeId]: { ...(prev[storeId] ?? policy), reorderThresholdDays: next },
                      }));
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Overstock Eşiği (DIR)</span>
                  <Input
                    type="number"
                    value={(draft ?? policy).overstockThresholdDays}
                    onChange={(e) => {
                      if (!storeId) return;
                      const next = clampInt(e.target.value, 90, 30, 365);
                      setDraftByStore((prev) => ({
                        ...prev,
                        [storeId]: { ...(prev[storeId] ?? policy), overstockThresholdDays: next },
                      }));
                    }}
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!storeId) return;
                    setDraftByStore((prev) => ({ ...prev, [storeId]: policy }));
                  }}
                >
                  Geri Al
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (typeof window === "undefined" || !storeId) return;
                    const next = draftByStore[storeId] ?? policy;
                    window.localStorage.setItem(
                      `nph_inventory_policy:${storeId}`,
                      JSON.stringify(next)
                    );
                    setEditingPolicy(false);
                  }}
                >
                  Kaydet
                </Button>
              </div>

              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Not: Bu ayarlar şimdilik tarayıcıda saklanır (localStorage). Supabase senkronu en son yapılacak.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Kritik Uyarılar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{criticalCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Stok 0 veya DIR ≤ 7 gün
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reorder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{reorderCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              DNR hariç, DIR ≤ {effectivePolicy.reorderThresholdDays} gün
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overstock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{overStockCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              DIR ≥ {effectivePolicy.overstockThresholdDays} gün (Liquidation Mode)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>DNR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{dnrCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Yeniden sipariş önerilmez
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Sipariş Planı (MVP)</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={reorderPlan.rows.length === 0}
                onClick={() => {
                  const rows = reorderPlan.rows.map((r) => ({
                    sku: r.p.sku,
                    urun: r.p.name,
                    stok: Number(r.p.stock_level ?? 0),
                    velocity: Number(r.p.velocity ?? 0),
                    dir_gun: r.dir == null ? "" : Math.round(r.dir),
                    onerilen_adet: Number(r.recommendedUnits ?? 0),
                    tahmini_teslim: reorderPlan.etaLabel,
                  }));
                  downloadCsv("netprofithub_siparis_plani.csv", toCsv(rows));
                }}
              >
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              DIR ≤ {effectivePolicy.reorderThresholdDays} gün olan ürünlerde, {effectivePolicy.leadTimeDays} gün lead time + {effectivePolicy.safetyDays} gün güvenlik + {effectivePolicy.targetCoverageDays} gün kapsama hedeflenir.
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tahmini teslim: {reorderPlan.etaLabel} • Toplam öneri: {reorderPlan.totalUnits} adet
            </div>

            {reorderPlan.rows.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">Sipariş önerisi yok.</div>
            ) : (
              <div className="w-full overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200/70 dark:border-slate-800/70">
                      <th className="px-3 py-3 text-left font-semibold">SKU</th>
                      <th className="px-3 py-3 text-left font-semibold">Ürün</th>
                      <th className="px-3 py-3 text-right font-semibold">DIR</th>
                      <th className="px-3 py-3 text-right font-semibold">Öneri</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reorderPlan.rows.map((r) => (
                      <tr key={r.p.id} className="border-b border-slate-200/70 dark:border-slate-800/70">
                        <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {r.p.sku}
                        </td>
                        <td className="px-3 py-3 font-medium">{r.p.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{dirLabel(r.dir)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold">
                          {r.recommendedUnits}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Not: Bu öneriler dummy veriye dayalıdır. Gerçek tedarik/MOQ/lot bilgileri entegrasyon sonrası eklenecek.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Liquidation Mode (MVP)</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={liquidationPlan.rows.length === 0}
                onClick={() => {
                  const rows = liquidationPlan.rows.map((r) => ({
                    sku: r.sku,
                    urun: r.name,
                    stok: r.stock,
                    velocity: r.velocity,
                    dir_gun: r.dir == null ? "" : Math.round(r.dir),
                    fazla_stok_adet: r.excessUnits,
                    onerilen_indirim: r.discountRange,
                    stil: r.kind,
                  }));
                  downloadCsv("netprofithub_liquidation_plani.csv", toCsv(rows));
                }}
              >
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              DIR ≥ {effectivePolicy.overstockThresholdDays} gün olan ürünlerde fazla stok için indirim kampanyası önerir.
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Toplam fazla stok: {liquidationPlan.totalExcess} adet • Hedef kapsama: {effectivePolicy.targetCoverageDays} gün
            </div>

            {liquidationPlan.rows.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">Liquidation adayı yok.</div>
            ) : (
              <div className="w-full overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200/70 dark:border-slate-800/70">
                      <th className="px-3 py-3 text-left font-semibold">SKU</th>
                      <th className="px-3 py-3 text-left font-semibold">Ürün</th>
                      <th className="px-3 py-3 text-right font-semibold">DIR</th>
                      <th className="px-3 py-3 text-right font-semibold">Fazla</th>
                      <th className="px-3 py-3 text-right font-semibold">İndirim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidationPlan.rows.map((r) => (
                      <tr key={r.sku} className="border-b border-slate-200/70 dark:border-slate-800/70">
                        <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {r.sku}
                        </td>
                        <td className="px-3 py-3 font-medium">{r.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{dirLabel(r.dir)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold">{r.excessUnits}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <Badge variant={r.kind === "agresif" ? "warning" : "default"}>
                            {r.discountRange}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Not: İndirim aralığı DIR bazlı heuristik bir tahmindir. Gerçek kâr/marj (COGS + iade + kargo) ile son aşamada optimize edilecek.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Ürünler</CardTitle>
            <div className="flex items-center gap-2">
              {(
                [
                  ["all", "Tümü"],
                  ["critical", "Kritik"],
                  ["reorder", "Reorder"],
                  ["overstock", "Overstock"],
                  ["dnr", "DNR"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={filter === key ? "secondary" : "ghost"}
                  onClick={() => setFilter(key)}
                  className={cn("h-7 px-2.5 text-xs")}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block max-w-md">
            <span className="text-xs text-slate-500 dark:text-slate-400">Ara (SKU / Ürün)</span>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Örn: NP-TEE" />
          </label>

          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>SKU</TH>
                <TH>Ürün</TH>
                <TH className="text-right">Stok</TH>
                <TH className="text-right">Velocity</TH>
                <TH className="text-right">DIR</TH>
                <TH className="text-right">Önerilen</TH>
                <TH>Durum</TH>
              </TRow>
            </THead>
            <tbody>
              {filtered.map(({ p, dir, overStock, critical, reorder, recommendedUnits }) => (
                <TRow key={p.id}>
                  <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {p.sku}
                  </TD>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-right tabular-nums">{p.stock_level}</TD>
                  <TD className="text-right tabular-nums">{p.velocity}</TD>
                  <TD className="text-right tabular-nums">{dirLabel(dir)}</TD>
                  <TD className="text-right tabular-nums">
                    {recommendedUnits == null ? "—" : recommendedUnits}
                  </TD>
                  <TD className="flex flex-wrap gap-2">
                    {p.dnr ? (
                      <Badge variant="warning">DNR</Badge>
                    ) : (
                      <Badge variant={reorder ? "success" : "default"}>
                        {reorder ? "Reorder" : "Stabil"}
                      </Badge>
                    )}
                    {critical && <Badge variant="danger">Kritik</Badge>}
                    {overStock && <Badge variant="warning">Overstock</Badge>}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
          {filtered.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Sonuç yok.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
