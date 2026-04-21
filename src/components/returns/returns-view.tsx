"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  fetchReturnsBySku,
  fetchReturnsSummary,
  fetchReturnsTimeseries,
} from "@/lib/queries/returns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrencyTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(p: number) {
  return new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 }).format(
    p
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(d);
}

export function ReturnsView() {
  const { storeId, dateRange } = useAppState();

  const summaryQuery = useQuery({
    queryKey: [
      "returnsSummary",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchReturnsSummary({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const seriesQuery = useQuery({
    queryKey: [
      "returnsSeries",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchReturnsTimeseries({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const skuQuery = useQuery({
    queryKey: [
      "returnsBySku",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchReturnsBySku({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        limit: 20,
      }),
    enabled: Boolean(storeId),
  });

  const chartPoints = useMemo(() => {
    const rows = seriesQuery.data ?? [];
    return rows.map((r) => ({
      date: r.date,
      label: shortDate(r.date),
      returnedUnits: r.returnedUnits,
      returnedRevenue: r.returnedRevenue,
    }));
  }, [seriesQuery.data]);

  if (!storeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Başlamak için</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-300">
          Üst bardan bir mağaza seçin veya “Mağaza Oluştur” ile ilk mağazanızı oluşturun.
        </CardContent>
      </Card>
    );
  }

  if (summaryQuery.isLoading || seriesQuery.isLoading || skuQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        İade verileri yükleniyor…
      </div>
    );
  }

  if (summaryQuery.isError || seriesQuery.isError || skuQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          İade analizi alınamadı. (order_items.returned_quantity alanını kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  const s = summaryQuery.data!;
  const skuRows = skuQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>İade Tutarı (MVP)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrencyTRY(s.returnedRevenue)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Satır bazlı tahmini iade cirosu
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>İade Adedi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{s.returnedUnits}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Returned units
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>İade Oranı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {s.returnRate == null ? "—" : formatPercent(s.returnRate)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              İade / (İade + Net satış)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net Kâr Etkisi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrencyTRY(s.estimatedProfitImpact)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MVP: Kargo/iade operasyon maliyeti hariç
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Günlük İade Trend</CardTitle>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (seriesQuery.data ?? []).map((r) => ({
                    date: r.date,
                    returned_units: r.returnedUnits,
                    returned_revenue_try: Math.round(r.returnedRevenue),
                  }));
                  const csv = toCsv(rows);
                  downloadCsv("netprofithub_iade_trend.csv", csv);
                }}
              >
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(Number(v))} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(2,6,23,0.9)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 12,
                    color: "white",
                  }}
                  formatter={(value: unknown, name: string) => {
                    const v = Number(value ?? 0);
                    if (name === "returnedRevenue") return [formatCurrencyTRY(v), "İade Tutarı"];
                    return [String(v), "İade Adedi"];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="returnedRevenue"
                  stroke="#fb7185"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="returnedUnits"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Hesap yöntemi</span>
              <Badge variant="default">MVP</Badge>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              İade tutarı, `order_items.returned_quantity` üzerinden satır bazlı tahminlenir.
              Kargo/komisyon/hasar maliyetleri sonraki adımda eklenecek.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>En Çok İade Alan SKU’lar</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const rows = skuRows.map((r) => ({
                  sku: r.sku,
                  name: r.name,
                  returned_units: r.returnedUnits,
                  return_rate: r.returnRate == null ? "" : Math.round(r.returnRate * 1000) / 1000,
                  returned_revenue_try: Math.round(r.returnedRevenue),
                }));
                const csv = toCsv(rows);
                downloadCsv("netprofithub_iade_sku.csv", csv);
              }}
              disabled={skuRows.length === 0}
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
                <TH className="text-right">İade</TH>
                <TH className="text-right">İade Oranı</TH>
                <TH className="text-right">İade Tutarı</TH>
              </TRow>
            </THead>
            <tbody>
              {skuRows.map((r) => (
                <TRow key={r.sku}>
                  <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.sku}</TD>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="text-right tabular-nums">{r.returnedUnits}</TD>
                  <TD className="text-right tabular-nums">
                    {r.returnRate == null ? "—" : formatPercent(r.returnRate)}
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(r.returnedRevenue)}</TD>
                </TRow>
              ))}
            </tbody>
          </Table>
          {skuRows.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Bu aralıkta iade yok.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
