"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { fetchProducts } from "@/lib/queries/products";
import { calculateDIR } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";

function dirLabel(dir: number | null) {
  if (dir == null) return "—";
  if (!Number.isFinite(dir)) return "—";
  return `${Math.round(dir)} gün`;
}

export function InventoryView() {
  const { storeId } = useAppState();

  const productsQuery = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => fetchProducts({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const enriched = useMemo(() => {
    const rows = productsQuery.data ?? [];
    return rows.map((p) => {
      const dir = calculateDIR(Number(p.stock_level ?? 0), Number(p.velocity ?? 0));
      const overStock = dir != null && dir >= 90;
      const critical = Number(p.stock_level ?? 0) <= 0 || (dir != null && dir <= 7);
      return { p, dir, overStock, critical };
    });
  }, [productsQuery.data]);

  const criticalCount = enriched.filter((x) => x.critical).length;
  const overStockCount = enriched.filter((x) => x.overStock).length;
  const dnrCount = enriched.filter((x) => x.p.dnr).length;

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
          <CardTitle>Stok Zekâsı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            DIR (Days of Inventory Remaining) = Stok / Ortalama Günlük Satış
            (Velocity). DNR işaretli ürünler için yeniden sipariş önerilmez.
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
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
            <CardTitle>Overstock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{overStockCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              DIR ≥ 90 gün (Liquidation Mode)
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

      <Card>
        <CardHeader>
          <CardTitle>Ürünler</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>SKU</TH>
                <TH>Ürün</TH>
                <TH className="text-right">Stok</TH>
                <TH className="text-right">Velocity</TH>
                <TH className="text-right">DIR</TH>
                <TH>Durum</TH>
              </TRow>
            </THead>
            <tbody>
              {enriched.map(({ p, dir, overStock, critical }) => (
                <TRow key={p.id}>
                  <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {p.sku}
                  </TD>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-right tabular-nums">{p.stock_level}</TD>
                  <TD className="text-right tabular-nums">{p.velocity}</TD>
                  <TD className="text-right tabular-nums">{dirLabel(dir)}</TD>
                  <TD className="flex flex-wrap gap-2">
                    {p.dnr ? (
                      <Badge variant="warning">DNR</Badge>
                    ) : (
                      <Badge variant="success">Reorder</Badge>
                    )}
                    {critical && <Badge variant="danger">Kritik</Badge>}
                    {overStock && <Badge variant="warning">Overstock</Badge>}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
          {enriched.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Henüz ürün yok. Supabase `products` tablosuna ürün ekleyin.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

