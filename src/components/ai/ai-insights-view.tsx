"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import {
  fetchAiInsights,
  type AiInventoryInsight,
  type AiSuggestion,
} from "@/lib/queries/ai-insights";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(d);
}

function severityVariant(s: AiSuggestion["severity"]) {
  if (s === "danger") return "danger";
  if (s === "warning") return "warning";
  if (s === "success") return "success";
  return "default";
}

function inventoryBadge(x: AiInventoryInsight) {
  if (x.kind === "critical") return <Badge variant="danger">Kritik</Badge>;
  if (x.kind === "reorder") return <Badge variant="success">Reorder</Badge>;
  if (x.kind === "overstock") return <Badge variant="warning">Overstock</Badge>;
  return <Badge variant="warning">DNR</Badge>;
}

export function AiInsightsView() {
  const { storeId, dateRange } = useAppState();
  const [chartMetric, setChartMetric] = useState<"revenue" | "netProfit" | "adSpend">(
    "revenue"
  );
  const { overrides } = useProfitOverrides(storeId);

  const insightsQuery = useQuery({
    queryKey: [
      "aiInsights",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchAiInsights({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        shippingCostPerOrder: overrides.shippingCostPerOrder,
        marketplaceFeeRate: overrides.marketplaceFeeRate,
      }),
    enabled: Boolean(storeId),
  });

  const chartPoints = useMemo(() => {
    const rows = insightsQuery.data?.series ?? [];
    return rows.map((r) => ({
      date: r.date,
      label: shortDate(r.date),
      revenue: r.revenue,
      adSpend: r.adSpend,
      netProfit: r.netProfit,
      isForecast: r.isForecast,
    }));
  }, [insightsQuery.data?.series]);

  const inv = useMemo(
    () => insightsQuery.data?.inventory ?? [],
    [insightsQuery.data?.inventory]
  );
  const invCounts = useMemo(() => {
    const critical = inv.filter((x) => x.kind === "critical").length;
    const reorder = inv.filter((x) => x.kind === "reorder").length;
    const overstock = inv.filter((x) => x.kind === "overstock").length;
    const dnr = inv.filter((x) => x.kind === "dnr").length;
    return { critical, reorder, overstock, dnr, total: inv.length };
  }, [inv]);

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

  if (insightsQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        İçgörüler hazırlanıyor…
      </div>
    );
  }

  if (insightsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          AI içgörüleri alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  const data = insightsQuery.data!;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Önümüzdeki 30 Gün Ciro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrencyTRY(data.forecast.next30Revenue)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Baz: son {data.basisDays} gün (moving average)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Önümüzdeki 30 Gün Net Kâr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrencyTRY(data.forecast.next30NetProfit)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Net Kâr = Ciro - (COGS + Reklam + Gider + Kargo + Komisyon)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Beklenen ROAS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {data.forecast.expectedRoas == null ? "—" : `${formatNumber(data.forecast.expectedRoas)}x`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Son {data.basisDays} gün trendi
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stok Riski</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{invCounts.critical}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kritik SKU (stok 0 veya DIR ≤ 7)
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Tahmin Grafiği</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={chartMetric === "revenue" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("revenue")}
                >
                  Ciro
                </Button>
                <Button
                  type="button"
                  variant={chartMetric === "netProfit" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("netProfit")}
                >
                  Net Kâr
                </Button>
                <Button
                  type="button"
                  variant={chartMetric === "adSpend" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMetric("adSpend")}
                >
                  Harcama
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(Number(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(2,6,23,0.9)",
                    border: "1px solid rgba(148,163,184,0.25)",
                    borderRadius: 12,
                    color: "white",
                  }}
                  formatter={(value: unknown, name: string) => {
                    const v = Number(value ?? 0);
                    const label =
                      name === "revenue"
                        ? "Ciro"
                        : name === "netProfit"
                          ? "Net Kâr"
                          : "Harcama";
                    return [formatCurrencyTRY(v), label];
                  }}
                />

                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={chartMetric === "revenue" ? "#60a5fa" : chartMetric === "netProfit" ? "#10b981" : "#a78bfa"}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Not: Kesikli ayrım yok; grafiğin son kısmı tahmindir (30 gün).
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aksiyon Önerileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.suggestions ?? []).map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{s.title}</div>
                  <Badge variant={severityVariant(s.severity)}>
                    {s.severity === "danger"
                      ? "Kritik"
                      : s.severity === "warning"
                        ? "Uyarı"
                        : s.severity === "success"
                          ? "İyi"
                          : "Bilgi"}
                  </Badge>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {s.detail}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Özet (Son {data.basisDays} Gün)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Ciro</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyTRY(data.last.revenue)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Reklam</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyTRY(data.last.adSpend)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>COGS</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyTRY(data.last.cogs)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Gider</span>
              <span className="font-medium tabular-nums">
                {formatCurrencyTRY(data.last.expenses)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
              <span>Net Kâr</span>
              <span className="font-semibold tabular-nums">
                {formatCurrencyTRY(data.last.netProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>ROAS</span>
              <span className="font-medium tabular-nums">
                {data.last.roas == null ? "—" : `${formatNumber(data.last.roas)}x`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>COS</span>
              <span className="font-medium tabular-nums">
                {data.last.cos == null ? "—" : formatNumber(data.last.cos)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stok İçgörüleri</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow className="border-b-0">
                  <TH>SKU</TH>
                  <TH>Ürün</TH>
                  <TH className="text-right">Stok</TH>
                  <TH className="text-right">DIR</TH>
                  <TH className="text-right">Öneri</TH>
                  <TH>Durum</TH>
                </TRow>
              </THead>
              <tbody>
                {inv.slice(0, 12).map((x) => (
                  <TRow key={x.sku}>
                    <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">
                      {x.sku}
                    </TD>
                    <TD className="font-medium">{x.name}</TD>
                    <TD className="text-right tabular-nums">{x.stockLevel}</TD>
                    <TD className="text-right tabular-nums">
                      {x.dir == null ? "—" : `${Math.round(x.dir)} gün`}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {x.recommendedUnits == null ? "—" : `${x.recommendedUnits} adet`}
                    </TD>
                    <TD className="flex flex-wrap gap-2">
                      {inventoryBadge(x)}
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>

            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Reorder önerileri MVP: `velocity` (günlük ortalama) üzerinden hesaplanır.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
