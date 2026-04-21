"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { fetchMarketingSpend } from "@/lib/queries/marketing";
import { fetchDashboardSummary } from "@/lib/queries/metrics";
import { safeDivide } from "@/lib/profitability";
import { fetchDailyMetrics } from "@/lib/queries/dashboard";
import { AdSpendBreakdown } from "@/components/dashboard/ad-spend-breakdown";
import { Button } from "@/components/ui/button";
import { fetchDashboardTimeseries } from "@/lib/queries/dashboard";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";
import { Badge } from "@/components/ui/badge";
import { downloadCsv, toCsv } from "@/lib/csv";
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
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(
    value
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(
    d
  );
}

export function MarketingView() {
  const { storeId, dateRange } = useAppState();
  const [chartMode, setChartMode] = useState<"spend" | "revenue" | "roi">("spend");
  const { overrides } = useProfitOverrides(storeId);

  const summaryQuery = useQuery({
    queryKey: [
      "dashboardSummary",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchDashboardSummary({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const dailyQuery = useQuery({
    queryKey: [
      "dailyMetrics",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchDailyMetrics({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const seriesQuery = useQuery({
    queryKey: [
      "dashboardSeries",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      overrides.shippingCostPerOrder,
      overrides.marketplaceFeeRate,
    ],
    queryFn: () =>
      fetchDashboardTimeseries({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        shippingCostPerOrder: overrides.shippingCostPerOrder,
        marketplaceFeeRate: overrides.marketplaceFeeRate,
      }),
    enabled: Boolean(storeId),
  });

  const spendQuery = useQuery({
    queryKey: [
      "marketingSpend",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchMarketingSpend({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const platformRows = useMemo(() => {
    const rows = spendQuery.data ?? [];
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = String(r.platform ?? "bilinmiyor");
      map.set(key, (map.get(key) ?? 0) + Number(r.spend ?? 0));
    }
    return Array.from(map.entries())
      .map(([platform, spend]) => ({ platform, spend }))
      .sort((a, b) => b.spend - a.spend);
  }, [spendQuery.data]);

  const chartPoints = useMemo(() => {
    const rows = dailyQuery.data ?? [];
    return rows.map((r) => ({
      date: r.date,
      label: formatShortDate(r.date),
      revenue: r.revenue,
      adSpend: r.adSpend,
      roi: r.roi ?? null,
      cos: r.cos ?? null,
    }));
  }, [dailyQuery.data]);

  const campaignRows = useMemo(() => {
    const rows = spendQuery.data ?? [];
    const map = new Map<string, { spend: number; platform: string }>();
    for (const r of rows) {
      const name = (r.campaign_name ?? "İsimsiz Kampanya").trim();
      const key = `${String(r.platform ?? "bilinmiyor")}::${name}`;
      const prev = map.get(key) ?? { spend: 0, platform: String(r.platform) };
      prev.spend += Number(r.spend ?? 0);
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .map(([key, v]) => {
        const [platform, campaign] = key.split("::");
        return { platform, campaign, spend: v.spend };
      })
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 20);
  }, [spendQuery.data]);

  const campaignAttribution = useMemo(() => {
    const spends = spendQuery.data ?? [];
    const series = seriesQuery.data ?? [];

    if (!storeId) return [];
    if (spends.length === 0 || series.length === 0) return [];

    const dayTotals = new Map<
      string,
      {
        revenue: number;
        profit: number;
      }
    >();
    for (const p of series) {
      const profit = p.netProfit;
      dayTotals.set(p.date, {
        revenue: p.revenue,
        profit,
      });
    }

    const spendByDay = new Map<string, number>();
    for (const s of spends) {
      const day = String(s.date);
      spendByDay.set(day, (spendByDay.get(day) ?? 0) + Number(s.spend ?? 0));
    }

    const byKey = new Map<
      string,
      { platform: string; campaign: string; spend: number; revenue: number; profit: number }
    >();

    for (const s of spends) {
      const day = String(s.date);
      const totalSpend = spendByDay.get(day) ?? 0;
      if (totalSpend <= 0) continue;
      const totals = dayTotals.get(day);
      if (!totals) continue;

      const share = Number(s.spend ?? 0) / totalSpend;
      const platform = String(s.platform ?? "bilinmiyor");
      const campaign = String(s.campaign_name ?? "İsimsiz Kampanya").trim();
      const key = `${platform}::${campaign}`;
      const prev =
        byKey.get(key) ??
        ({
          platform,
          campaign,
          spend: 0,
          revenue: 0,
          profit: 0,
        } satisfies {
          platform: string;
          campaign: string;
          spend: number;
          revenue: number;
          profit: number;
        });

      prev.spend += Number(s.spend ?? 0);
      prev.revenue += totals.revenue * share;
      prev.profit += totals.profit * share;

      byKey.set(key, prev);
    }

    return Array.from(byKey.values())
      .map((r) => ({
        ...r,
        roas: safeDivide(r.revenue, r.spend),
        margin: safeDivide(r.profit, r.revenue),
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 20);
  }, [seriesQuery.data, spendQuery.data, storeId]);

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

  if (
    summaryQuery.isLoading ||
    spendQuery.isLoading ||
    dailyQuery.isLoading ||
    seriesQuery.isLoading
  ) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Veriler yükleniyor…
      </div>
    );
  }

  if (
    summaryQuery.isError ||
    spendQuery.isError ||
    dailyQuery.isError ||
    seriesQuery.isError
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Pazarlama verileri alınamadı. (Supabase tabloları/izinleri kontrol
          edin.)
        </CardContent>
      </Card>
    );
  }

  const grossSales = summaryQuery.data!.grossSales;
  const adSpend = summaryQuery.data!.adSpend;
  const roas = safeDivide(grossSales, adSpend);
  const mer = safeDivide(adSpend, grossSales);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Toplam Reklam Harcaması</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(adSpend)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Seçili tarih aralığı (mağaza bazlı)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ROAS (Genel)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {roas == null ? "—" : `${formatNumber(roas)}x`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ROAS = Gelir / Reklam Harcaması
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>MER (Genel)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {mer == null ? "—" : formatNumber(mer)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MER = Reklam Harcaması / Gelir
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Harcama & Verimlilik</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={chartMode === "spend" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMode("spend")}
                >
                  Harcama
                </Button>
                <Button
                  type="button"
                  variant={chartMode === "revenue" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMode("revenue")}
                >
                  Gelir
                </Button>
                <Button
                  type="button"
                  variant={chartMode === "roi" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setChartMode("roi")}
                >
                  ROAS
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPoints}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    chartMode === "roi" ? formatNumber(Number(v)) : formatCompact(Number(v))
                  }
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
                    if (name === "roi") return [`${formatNumber(v)}x`, "ROAS"];
                    if (name === "adSpend") return [formatCurrencyTRY(v), "Harcama"];
                    if (name === "revenue") return [formatCurrencyTRY(v), "Gelir"];
                    return [String(value), name];
                  }}
                  labelFormatter={(label: unknown) => String(label)}
                />

                {chartMode === "spend" && (
                  <Line
                    type="monotone"
                    dataKey="adSpend"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {chartMode === "revenue" && (
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                {chartMode === "roi" && (
                  <Line
                    type="monotone"
                    dataKey="roi"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <AdSpendBreakdown rows={platformRows} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>En Çok Harcama Yapılan Kampanyalar</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>Platform</TH>
                <TH>Kampanya</TH>
                <TH className="text-right">Harcama</TH>
              </TRow>
            </THead>
            <tbody>
              {campaignRows.map((r) => (
                <TRow key={`${r.platform}:${r.campaign}`}>
                  <TD className="text-slate-600 dark:text-slate-300">
                    {r.platform}
                  </TD>
                  <TD className="font-medium">{r.campaign}</TD>
                  <TD className="text-right tabular-nums">
                    {formatCurrencyTRY(r.spend)}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Not: Kampanya bazlı “Net Kâr” atfı (UTM/attribution) en son adımda eklenecek.
          </div>
          {campaignRows.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Kampanya verisi yok.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Kampanya Net Kâr Atfı</CardTitle>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                MVP simülasyonu: Günlük ciro/COGS/kargo/komisyon “harcama payına” göre kampanyalara dağıtılır. Gerçek UTM atfı en son adımda.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">Simülasyon</Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = campaignAttribution.map((r) => ({
                    platform: r.platform,
                    campaign: r.campaign,
                    spend_try: Math.round(r.spend),
                    attributed_revenue_try: Math.round(r.revenue),
                    attributed_net_profit_try: Math.round(r.profit),
                    roas: r.roas == null ? "" : Math.round(r.roas * 100) / 100,
                    margin: r.margin == null ? "" : Math.round(r.margin * 1000) / 1000,
                  }));
                  const csv = toCsv(rows);
                  downloadCsv("netprofithub_kampanya_net_kar_atfi.csv", csv);
                }}
                disabled={campaignAttribution.length === 0}
              >
                CSV İndir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>Platform</TH>
                <TH>Kampanya</TH>
                <TH className="text-right">Harcama</TH>
                <TH className="text-right">Atfedilen Ciro</TH>
                <TH className="text-right">Atfedilen Net Kâr</TH>
                <TH className="text-right">ROAS</TH>
                <TH className="text-right">Marj</TH>
              </TRow>
            </THead>
            <tbody>
              {campaignAttribution.map((r) => (
                <TRow key={`${r.platform}:${r.campaign}`}>
                  <TD className="text-slate-600 dark:text-slate-300">{r.platform}</TD>
                  <TD className="font-medium">{r.campaign}</TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(r.spend)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(r.revenue)}</TD>
                  <TD className="text-right tabular-nums">
                    <span className={r.profit < 0 ? "text-rose-700 dark:text-rose-200" : undefined}>
                      {formatCurrencyTRY(r.profit)}
                    </span>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.roas == null ? "—" : `${formatNumber(r.roas)}x`}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.margin == null ? "—" : formatPercent(r.margin)}
                  </TD>
                </TRow>
              ))}
            </tbody>
          </Table>

          {campaignAttribution.length === 0 && (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Bu aralıkta kampanya verisi yok.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
