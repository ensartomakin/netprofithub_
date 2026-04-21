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
import { fetchOrders } from "@/lib/queries/orders";
import { toLocalISODate } from "@/lib/date";
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

function formatPercent(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function channelLabel(channel: string | null | undefined) {
  const c = String(channel ?? "");
  if (c === "web") return "Web (Tsoft)";
  if (c === "trendyol") return "Trendyol";
  if (c === "hepsiburada") return "Hepsiburada";
  if (c === "amazon") return "Amazon";
  if (!c) return "—";
  return c;
}

export function MarketingView() {
  const { storeId, dateRange } = useAppState();
  const [chartMode, setChartMode] = useState<"spend" | "revenue" | "roi">("spend");
  const [channelFilter, setChannelFilter] = useState<
    "all" | "web" | "trendyol" | "hepsiburada" | "amazon"
  >("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
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

  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => fetchOrders({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const availablePlatforms = useMemo(() => {
    const rows = spendQuery.data ?? [];
    const s = new Set<string>();
    for (const r of rows) s.add(String(r.platform ?? "bilinmiyor"));
    return Array.from(s.values()).sort((a, b) => a.localeCompare(b));
  }, [spendQuery.data]);

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

  const channelPerformance = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const paid = orders.filter((o) => String(o.status) === "odendi");

    // spend by day (from spend rows)
    const spends = spendQuery.data ?? [];
    const spendByDay = new Map<string, number>();
    for (const s of spends) {
      const day = String(s.date);
      spendByDay.set(day, (spendByDay.get(day) ?? 0) + Number(s.spend ?? 0));
    }

    // profit by day (from dashboard series)
    const series = seriesQuery.data ?? [];
    const profitByDay = new Map<string, number>();
    for (const p of series) profitByDay.set(String(p.date), Number(p.netProfit ?? 0));

    // revenue/orders by day & channel
    const revenueByDay = new Map<string, number>();
    const byDayChannel = new Map<string, Map<string, { revenue: number; orders: number }>>();
    for (const o of paid) {
      const day = toLocalISODate(new Date(String(o.ordered_at)));
      const channel = String(o.channel ?? "bilinmiyor");
      const revenue = Number(o.amount ?? 0);

      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + revenue);
      const m = byDayChannel.get(day) ?? new Map<string, { revenue: number; orders: number }>();
      const prev = m.get(channel) ?? { revenue: 0, orders: 0 };
      prev.revenue += revenue;
      prev.orders += 1;
      m.set(channel, prev);
      byDayChannel.set(day, m);
    }

    const acc = new Map<string, { channel: string; revenue: number; spend: number; profit: number; orders: number }>();
    for (const [day, m] of byDayChannel.entries()) {
      const dayRevenue = revenueByDay.get(day) ?? 0;
      if (dayRevenue <= 0) continue;
      const daySpend = spendByDay.get(day) ?? 0;
      const dayProfit = profitByDay.get(day) ?? 0;

      for (const [channel, v] of m.entries()) {
        const share = v.revenue / dayRevenue;
        const prev = acc.get(channel) ?? { channel, revenue: 0, spend: 0, profit: 0, orders: 0 };
        prev.revenue += v.revenue;
        prev.orders += v.orders;
        prev.spend += daySpend * share;
        prev.profit += dayProfit * share;
        acc.set(channel, prev);
      }
    }

    const spendTotal = Array.from(acc.values()).reduce((a, x) => a + x.spend, 0);

    return Array.from(acc.values())
      .map((r) => ({
        ...r,
        roas: safeDivide(r.revenue, r.spend),
        mer: safeDivide(r.spend, r.revenue),
        margin: safeDivide(r.profit, r.revenue),
        spendShare: safeDivide(r.spend, spendTotal),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [ordersQuery.data, seriesQuery.data, spendQuery.data]);

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
      if (platformFilter !== "all" && String(r.platform ?? "") !== platformFilter) continue;
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
  }, [platformFilter, spendQuery.data]);

  const campaignAttribution = useMemo(() => {
    const spends = spendQuery.data ?? [];
    const series = seriesQuery.data ?? [];
    const orders = ordersQuery.data ?? [];

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

    // channel revenue by day (paid only)
    const paidOrders = orders.filter((o) => String(o.status) === "odendi");
    const channelRevenueByDay = new Map<string, Map<string, number>>();
    const totalRevenueByDay = new Map<string, number>();
    for (const o of paidOrders) {
      const day = toLocalISODate(new Date(String(o.ordered_at)));
      const channel = String(o.channel ?? "bilinmiyor");
      const revenue = Number(o.amount ?? 0);
      totalRevenueByDay.set(day, (totalRevenueByDay.get(day) ?? 0) + revenue);
      const m = channelRevenueByDay.get(day) ?? new Map<string, number>();
      m.set(channel, (m.get(channel) ?? 0) + revenue);
      channelRevenueByDay.set(day, m);
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
      if (platformFilter !== "all" && String(s.platform ?? "") !== platformFilter) continue;

      const totalSpend = spendByDay.get(day) ?? 0;
      if (totalSpend <= 0) continue;
      const totals = dayTotals.get(day);
      if (!totals) continue;

      const channelShare =
        channelFilter === "all"
          ? 1
          : (() => {
              const total = totalRevenueByDay.get(day) ?? 0;
              if (total <= 0) return 0;
              const m = channelRevenueByDay.get(day);
              const ch = m?.get(channelFilter) ?? 0;
              return ch / total;
            })();
      if (channelShare <= 0) continue;

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
      prev.revenue += totals.revenue * share * channelShare;
      prev.profit += totals.profit * share * channelShare;

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
  }, [channelFilter, ordersQuery.data, platformFilter, seriesQuery.data, spendQuery.data, storeId]);

  const platformAttribution = useMemo(() => {
    const map = new Map<string, { platform: string; spend: number; revenue: number; profit: number }>();
    for (const r of campaignAttribution) {
      const key = String(r.platform ?? "bilinmiyor");
      const prev = map.get(key) ?? { platform: key, spend: 0, revenue: 0, profit: 0 };
      prev.spend += Number(r.spend ?? 0);
      prev.revenue += Number(r.revenue ?? 0);
      prev.profit += Number(r.profit ?? 0);
      map.set(key, prev);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        roas: safeDivide(r.revenue, r.spend),
        margin: safeDivide(r.profit, r.revenue),
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [campaignAttribution]);

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
    seriesQuery.isLoading ||
    ordersQuery.isLoading
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
    seriesQuery.isError ||
    ordersQuery.isError
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Filtreler</CardTitle>
            <Badge variant="default">MVP</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">Kanal</span>
            <select
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(
                  e.target.value as "all" | "web" | "trendyol" | "hepsiburada" | "amazon"
                )
              }
              className="mt-1 h-9 w-full rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-400/30"
            >
              <option value="all">Tümü</option>
              <option value="web">Web (Tsoft)</option>
              <option value="trendyol">Trendyol</option>
              <option value="hepsiburada">Hepsiburada</option>
              <option value="amazon">Amazon</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">Reklam Platformu</span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-400/30"
            >
              <option value="all">Tümü</option>
              {availablePlatforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
            Not: Kanal filtresi, kampanya “net kâr atfını” kanalın günlük ciro payına göre daraltır (simülasyon).
          </div>
        </CardContent>
      </Card>

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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kanal Performansı (Simülasyon)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow className="border-b-0">
                  <TH>Kanal</TH>
                  <TH className="text-right">Sipariş</TH>
                  <TH className="text-right">Ciro</TH>
                  <TH className="text-right">Harcama</TH>
                  <TH className="text-right">Net Kâr</TH>
                  <TH className="text-right">ROAS</TH>
                </TRow>
              </THead>
              <tbody>
                {channelPerformance.slice(0, 10).map((r) => (
                  <TRow key={r.channel}>
                    <TD className="font-medium">{channelLabel(r.channel)}</TD>
                    <TD className="text-right tabular-nums">{r.orders}</TD>
                    <TD className="text-right tabular-nums">{formatCurrencyTRY(r.revenue)}</TD>
                    <TD className="text-right tabular-nums">{formatCurrencyTRY(r.spend)}</TD>
                    <TD className="text-right tabular-nums">
                      <span className={r.profit < 0 ? "text-rose-700 dark:text-rose-200" : undefined}>
                        {formatCurrencyTRY(r.profit)}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">{r.roas == null ? "—" : `${formatNumber(r.roas)}x`}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
            {channelPerformance.length === 0 && (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Kanal verisi yok.
              </div>
            )}
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Not: Harcama ve net kâr, gün bazında kanalın ciro payına göre dağıtılır (MVP simülasyonu).
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Net Kâr Özeti (Simülasyon)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TRow className="border-b-0">
                  <TH>Platform</TH>
                  <TH className="text-right">Harcama</TH>
                  <TH className="text-right">Atfedilen Ciro</TH>
                  <TH className="text-right">Atfedilen Net Kâr</TH>
                  <TH className="text-right">ROAS</TH>
                  <TH className="text-right">Marj</TH>
                </TRow>
              </THead>
              <tbody>
                {platformAttribution.slice(0, 10).map((r) => (
                  <TRow key={r.platform}>
                    <TD className="font-medium">{r.platform}</TD>
                    <TD className="text-right tabular-nums">{formatCurrencyTRY(r.spend)}</TD>
                    <TD className="text-right tabular-nums">{formatCurrencyTRY(r.revenue)}</TD>
                    <TD className="text-right tabular-nums">
                      <span className={r.profit < 0 ? "text-rose-700 dark:text-rose-200" : undefined}>
                        {formatCurrencyTRY(r.profit)}
                      </span>
                    </TD>
                    <TD className="text-right tabular-nums">{r.roas == null ? "—" : `${formatNumber(r.roas)}x`}</TD>
                    <TD className="text-right tabular-nums">{r.margin == null ? "—" : formatPercent(r.margin)}</TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
            {platformAttribution.length === 0 && (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Platform özeti için veri yok.
              </div>
            )}
          </CardContent>
        </Card>
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
              {(channelFilter !== "all" || platformFilter !== "all") && (
                <Badge variant="default">
                  {channelFilter !== "all" ? channelLabel(channelFilter) : "Tüm kanallar"}
                  {platformFilter !== "all" ? ` • ${platformFilter}` : ""}
                </Badge>
              )}
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
                    channel: channelFilter === "all" ? "" : channelFilter,
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
