"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { fetchProducts } from "@/lib/queries/products";
import { fetchOrderItems } from "@/lib/queries/order-items";
import { aggregateSkuProfit, safeDivide } from "@/lib/profitability";
import { updateProductCogs, updateProductDnr } from "@/lib/queries/update-product";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calculateDIR } from "@/lib/inventory";
import { downloadCsv, toCsv } from "@/lib/csv";

function formatCurrencyTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ProductsView() {
  const { storeId, dateRange } = useAppState();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<
    "all" | "loss" | "critical" | "overstock" | "dnr"
  >("all");
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => fetchProducts({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const itemsQuery = useQuery({
    queryKey: [
      "orderItems",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchOrderItems({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const profitBySku = useMemo(() => {
    const agg = aggregateSkuProfit(itemsQuery.data ?? []);
    const map = new Map<string, typeof agg[number]>();
    for (const row of agg) map.set(row.sku, row);
    return map;
  }, [itemsQuery.data]);

  const updateCogs = useMutation({
    mutationFn: updateProductCogs,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
  });

  const toggleDnr = useMutation({
    mutationFn: updateProductDnr,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
    },
  });

  const rows = useMemo(() => {
    const products = productsQuery.data ?? [];
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      if (!query) return true;
      return (
        p.sku.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
      );
    });
  }, [productsQuery.data, q]);

  const enriched = useMemo(() => {
    return rows
      .map((p) => {
        const agg = profitBySku.get(p.sku);
        const units = agg?.units ?? 0;
        const revenue = agg?.revenue ?? 0;
        const returnsUnits = agg?.returnsUnits ?? 0;

        const cogs = Number(p.cogs ?? 0);
        const unitRevenue = safeDivide(revenue, units) ?? 0;
        const unitProfit = unitRevenue - cogs;
        const totalProfit = revenue - units * cogs;
        const margin = safeDivide(totalProfit, revenue);
        const returnRate = safeDivide(returnsUnits, Math.max(1, units + returnsUnits));

        const stock = Number(p.stock_level ?? 0);
        const velocity = Number(p.velocity ?? 0);
        const dir = calculateDIR(stock, velocity);
        const critical = stock <= 0 || (dir != null && dir <= 7);
        const overstock = dir != null && dir >= 90;

        return {
          product: p,
          units,
          revenue,
          returnsUnits,
          returnRate,
          cogs,
          unitProfit,
          totalProfit,
          margin,
          dir,
          critical,
          overstock,
        };
      })
      .filter((x) => {
        if (filter === "all") return true;
        if (filter === "dnr") return Boolean(x.product.dnr);
        if (filter === "critical") return x.critical;
        if (filter === "overstock") return x.overstock;
        if (filter === "loss") return x.totalProfit < 0;
        return true;
      })
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }, [filter, profitBySku, rows]);

  const stats = useMemo(() => {
    const loss = enriched.filter((x) => x.totalProfit < 0).length;
    const critical = enriched.filter((x) => x.critical).length;
    const overstock = enriched.filter((x) => x.overstock).length;
    const dnr = enriched.filter((x) => x.product.dnr).length;
    return { loss, critical, overstock, dnr, total: enriched.length };
  }, [enriched]);

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
          <CardTitle>Ürün Kârlılığı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Ara (SKU veya ürün adı)
                </span>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Örn: NP-TEE veya Hoodie"
                />
              </label>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 md:self-end">
              Kârlılık hesapları `order_items` verisine göre yapılır (tarih
              aralığına bağlı).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Tümü
            </Button>
            <Button
              type="button"
              variant={filter === "loss" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("loss")}
            >
              Zarar Eden
            </Button>
            <Button
              type="button"
              variant={filter === "critical" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("critical")}
            >
              Kritik Stok
            </Button>
            <Button
              type="button"
              variant={filter === "overstock" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("overstock")}
            >
              Overstock
            </Button>
            <Button
              type="button"
              variant={filter === "dnr" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("dnr")}
            >
              DNR
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Toplam</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.total}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Filtre sonrası liste
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Zarar Eden</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.loss}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kâr &lt; 0
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kritik Stok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.critical}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Stok 0 veya DIR ≤ 7
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overstock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.overstock}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              DIR ≥ 90
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>DNR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.dnr}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Yeniden sipariş yok
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Liste</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const rowsCsv = enriched.map((x) => ({
                  sku: x.product.sku,
                  name: x.product.name,
                  stock_level: x.product.stock_level,
                  velocity: x.product.velocity,
                  dir: x.dir == null ? "" : Math.round(x.dir),
                  units: x.units,
                  revenue_try: Math.round(x.revenue),
                  cogs_try: Math.round(x.cogs),
                  profit_try: Math.round(x.totalProfit),
                  margin: x.margin == null ? "" : Math.round(x.margin * 1000) / 1000,
                  returned_units: x.returnsUnits,
                  return_rate: x.returnRate == null ? "" : Math.round(x.returnRate * 1000) / 1000,
                  dnr: x.product.dnr ? "evet" : "hayir",
                }));
                const csv = toCsv(rowsCsv);
                downloadCsv("netprofithub_urun_karlilik.csv", csv);
              }}
              disabled={enriched.length === 0}
            >
              CSV İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>SKU</TH>
                <TH>Ürün</TH>
                <TH className="text-right">Stok</TH>
                <TH className="text-right">DIR</TH>
                <TH className="text-right">Satış</TH>
                <TH className="text-right">Gelir</TH>
                <TH className="text-right">İade</TH>
                <TH className="text-right">COGS</TH>
                <TH className="text-right">Kâr</TH>
                <TH className="text-right">Marj</TH>
                <TH>Durum</TH>
              </TRow>
            </THead>
            <tbody>
              {enriched.map((x) => {
                const p = x.product;
                return (
                  <TRow key={p.id}>
                    <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {p.sku}
                    </TD>
                    <TD className="font-medium">{p.name}</TD>
                    <TD className="text-right tabular-nums">{p.stock_level}</TD>
                    <TD className="text-right tabular-nums">
                      {x.dir == null ? "—" : `${Math.round(x.dir)}g`}
                    </TD>
                    <TD className="text-right tabular-nums">{x.units}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrencyTRY(x.revenue)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {x.returnsUnits}
                      {x.returnRate == null ? null : (
                        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                          ({formatPercent(x.returnRate)})
                        </span>
                      )}
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          className="w-28 text-right tabular-nums"
                          type="number"
                          step="0.01"
                          defaultValue={x.cogs}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next)) return;
                            if (next === x.cogs) return;
                            updateCogs.mutate({ id: p.id, cogs: next });
                          }}
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ₺
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 text-right mt-1">
                        Birim kâr: {formatCurrencyTRY(x.unitProfit)}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">
                      <span
                        className={
                          x.totalProfit < 0
                            ? "text-rose-700 dark:text-rose-200"
                            : undefined
                        }
                      >
                        {formatCurrencyTRY(x.totalProfit)}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">
                      {x.margin == null ? "—" : formatPercent(x.margin)}
                    </TD>
                    <TD className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => toggleDnr.mutate({ id: p.id, dnr: !p.dnr })}
                        className="inline-flex"
                        title="DNR durumunu değiştir"
                      >
                        {p.dnr ? (
                          <Badge variant="warning">DNR</Badge>
                        ) : (
                          <Badge variant="success">Reorder</Badge>
                        )}
                      </button>
                      {x.totalProfit < 0 && <Badge variant="danger">Zarar</Badge>}
                      {x.critical && <Badge variant="danger">Kritik</Badge>}
                      {x.overstock && <Badge variant="warning">Overstock</Badge>}
                      {String(p.status) !== "aktif" && (
                        <Badge variant="default">Pasif</Badge>
                      )}
                      {(updateCogs.isPending || toggleDnr.isPending) && (
                        <Badge variant="default">Kaydediliyor…</Badge>
                      )}
                    </TD>
                  </TRow>
                );
              })}
            </tbody>
          </Table>

          {enriched.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Sonuç yok.
            </div>
          )}

          {itemsQuery.isFetching && (
            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Kârlılık verileri güncelleniyor…
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
