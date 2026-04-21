"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { fetchDashboardSummary } from "@/lib/queries/metrics";
import { calculateMer, calculateNetProfit, calculateRoas } from "@/lib/trueprofit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchProducts } from "@/lib/queries/products";
import { fetchOrders } from "@/lib/queries/orders";
import {
  fetchDashboardTimeseries,
  fetchDailyMetrics,
  fetchMonthSummary,
  fetchPlatformSpend,
  fetchTopProducts,
} from "@/lib/queries/dashboard";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ProgressRing } from "@/components/dashboard/progress-ring";
import { AdSpendBreakdown } from "@/components/dashboard/ad-spend-breakdown";
import { MetricsTable } from "@/components/dashboard/metrics-table";
import { useDashboardTargets } from "@/components/dashboard/use-dashboard-targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetWidgets } from "@/components/dashboard/budget-widgets";
import { ActionCenter, type ActionItem } from "@/components/dashboard/action-center";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";

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

function channelLabel(channel: string | null | undefined) {
  const c = String(channel ?? "");
  if (c === "web") return "Web (Tsoft)";
  if (c === "trendyol") return "Trendyol";
  if (c === "hepsiburada") return "Hepsiburada";
  if (c === "amazon") return "Amazon";
  if (!c) return "—";
  return c;
}

function buildActionItems(args: {
  paceDeviation: number | null;
  roiDeviation: number | null;
  cos: number | null;
  critical: number;
  overstock: number;
}): ActionItem[] {
  const items: ActionItem[] = [];

  if (args.paceDeviation != null && args.paceDeviation < -0.05) {
    items.push({
      title: "Ciro hedefinin gerisindesiniz",
      detail:
        "Günlük gereken ciroyu yakalamak için bütçe dağılımını ve kampanya hedeflemelerini gözden geçirin.",
      severity: "warning",
    });
  }

  if (args.roiDeviation != null && args.roiDeviation < -0.05) {
    items.push({
      title: "ROI hedefin altında",
      detail:
        "Kârlı SKU’lara bütçe kaydırın; düşük marjlı ürünlerde fiyat/COGS’i kontrol edin.",
      severity: "danger",
    });
  }

  if (args.cos != null && args.cos > 0.2) {
    items.push({
      title: "COS yüksek",
      detail:
        "Reklam harcaması ciroya göre yüksek görünüyor. Kreatif/segment testleri ve hedef ROI’ye göre bütçe limitleri uygulayın.",
      severity: "warning",
    });
  }

  if (args.critical > 0) {
    items.push({
      title: "Kritik stok uyarısı",
      detail: `${args.critical} ürün için stok 0 veya DIR ≤ 7 gün. Satış kaybını önlemek için önceliklendirin.`,
      severity: "danger",
    });
  }

  if (args.overstock > 0) {
    items.push({
      title: "Overstock ürünler",
      detail: `${args.overstock} üründe DIR ≥ 90 gün. Liquidation/indirim kampanyası tetikleyin.`,
      severity: "info",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "Genel durum stabil",
      detail:
        "Hedef sapmaları sınırlı. Kazanan kampanyaları ölçekleyip COGS/iadeleri takip edin.",
      severity: "success",
    });
  }

  return items;
}

export function DashboardView() {
  const { storeId, dateRange } = useAppState();
  const { targets, setTargets } = useDashboardTargets(storeId);
  const [editingTargets, setEditingTargets] = useState(false);
  const [chartMode, setChartMode] = useState<"profit" | "cost">("profit");
  const { overrides } = useProfitOverrides(storeId);

  const summaryQuery = useQuery({
    queryKey: ["dashboardSummary", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () =>
      fetchDashboardSummary({
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

  const platformSpendQuery = useQuery({
    queryKey: [
      "platformSpend",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchPlatformSpend({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: Boolean(storeId),
  });

  const topProductsQuery = useQuery({
    queryKey: [
      "topProducts",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchTopProducts({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        limit: 8,
      }),
    enabled: Boolean(storeId),
  });

  const productsQuery = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => fetchProducts({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const summary = summaryQuery.data;

  const monthSummaryQuery = useQuery({
    queryKey: ["monthSummary", storeId, targets.revenueTarget, targets.roiTarget],
    queryFn: () =>
      fetchMonthSummary({
        storeId: storeId!,
        target: { revenueTarget: targets.revenueTarget, roiTarget: targets.roiTarget },
      }),
    enabled: Boolean(storeId),
  });

  const dailyMetricsQuery = useQuery({
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

  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => fetchOrders({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const channelBreakdown = useMemo(() => {
    const rows = ordersQuery.data ?? [];
    const paid = rows.filter((o) => String(o.status) === "odendi");
    const totalRevenue = paid.reduce((acc, o) => acc + Number(o.amount ?? 0), 0);

    const map = new Map<string, { orders: number; revenue: number }>();
    for (const o of paid) {
      const key = String(o.channel ?? "bilinmiyor");
      const prev = map.get(key) ?? { orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += Number(o.amount ?? 0);
      map.set(key, prev);
    }

    return Array.from(map.entries())
      .map(([channel, v]) => ({
        channel,
        orders: v.orders,
        revenue: v.revenue,
        share: totalRevenue > 0 ? v.revenue / totalRevenue : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [ordersQuery.data]);

  const netProfit = useMemo(() => {
    if (!summary) return null;
    const tx = (dailyMetricsQuery.data ?? []).reduce(
      (acc, r) => acc + Number(r.transactions ?? 0),
      0
    );
    const shippingCost = tx * Number(overrides.shippingCostPerOrder ?? 0);
    const marketplaceFees =
      summary.grossSales * Number(overrides.marketplaceFeeRate ?? 0);
    const returnCosts = Math.abs(summary.returns) * Number(overrides.returnCostRate ?? 0);
    return calculateNetProfit({
      grossSales: summary.grossSales,
      cogs: summary.cogsTotal,
      shipping: shippingCost,
      adSpend: summary.adSpend,
      marketplaceFees,
      returns: summary.returns,
      returnCosts,
      fixedExpenses: summary.expensesTotal,
    });
  }, [
    dailyMetricsQuery.data,
    overrides.marketplaceFeeRate,
    overrides.returnCostRate,
    overrides.shippingCostPerOrder,
    summary,
  ]);

  const roas = useMemo(() => {
    if (!summary) return null;
    return calculateRoas(summary.grossSales, summary.adSpend);
  }, [summary]);

  const mer = useMemo(() => {
    if (!summary) return null;
    return calculateMer(summary.grossSales, summary.adSpend);
  }, [summary]);

  const alerts = useMemo(() => {
    const rows = productsQuery.data ?? [];
    let critical = 0;
    let overstock = 0;
    let dnr = 0;
    for (const p of rows) {
      if (p.dnr) dnr += 1;
      const stock = Number(p.stock_level ?? 0);
      const velocity = Number(p.velocity ?? 0);
      const dir = velocity > 0 ? stock / velocity : null;
      if (stock <= 0 || (dir != null && dir <= 7)) critical += 1;
      if (dir != null && dir >= 90) overstock += 1;
    }
    return { critical, overstock, dnr, total: rows.length };
  }, [productsQuery.data]);

  const rangeTotals = useMemo(() => {
    const rows = dailyMetricsQuery.data ?? [];
    const revenue = rows.reduce((a, r) => a + r.revenue, 0);
    const spend = rows.reduce((a, r) => a + r.adSpend, 0);
    const tx = rows.reduce((a, r) => a + r.transactions, 0);
    const aov = tx > 0 ? revenue / tx : null;
    const cos = revenue > 0 ? spend / revenue : null;
    return { revenue, spend, tx, aov, cos };
  }, [dailyMetricsQuery.data]);

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

  if (summaryQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Veriler yükleniyor…
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Dashboard verileri alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  const points = seriesQuery.data ?? [];
  const platformRows = platformSpendQuery.data ?? [];
  const topRows = topProductsQuery.data ?? [];

  const monthSummary = monthSummaryQuery.data;
  const monthProgress =
    monthSummary && monthSummary.target.revenueTarget > 0
      ? monthSummary.revenueToDate / monthSummary.target.revenueTarget
      : 0;
  const revenueChangePct =
    monthSummary && monthSummary.revenueLastMonthToDate > 0
      ? (monthSummary.revenueToDate - monthSummary.revenueLastMonthToDate) /
        monthSummary.revenueLastMonthToDate
      : null;
  const projectedDeviation =
    monthSummary && monthSummary.target.revenueTarget > 0
      ? (monthSummary.projectedMonthEndRevenue - monthSummary.target.revenueTarget) /
        monthSummary.target.revenueTarget
      : null;
  const remainingToTarget =
    monthSummary
      ? Math.max(0, monthSummary.target.revenueTarget - monthSummary.revenueToDate)
      : 0;
  const daysLeft =
    monthSummary ? Math.max(1, monthSummary.daysInMonth - monthSummary.daysElapsed) : 1;
  const requiredDailyRevenue = remainingToTarget / daysLeft;

  const roiDeviation =
    monthSummary && monthSummary.target.roiTarget > 0 && monthSummary.roiToDate != null
      ? (monthSummary.roiToDate - monthSummary.target.roiTarget) /
        monthSummary.target.roiTarget
      : null;

  const actions = buildActionItems({
    paceDeviation: monthSummary?.paceDeviation ?? null,
    roiDeviation,
    cos: rangeTotals.cos ?? null,
    critical: alerts.critical,
    overstock: alerts.overstock,
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Ay Özeti</CardTitle>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {monthSummary?.monthLabel ?? "—"} (hedef ve öngörü)
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingTargets((v) => !v)}
              >
                {editingTargets ? "Kapat" : "Hedef Düzenle"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ProgressRing
                value={monthProgress}
                label="Hedefe İlerleme"
                sublabel={
                  monthSummary
                    ? `${formatCurrencyTRY(monthSummary.revenueToDate)} / ${formatCurrencyTRY(
                        monthSummary.target.revenueTarget
                      )}`
                    : undefined
                }
              />
            </div>
            <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Toplam Ciro (Ay)
                </div>
                <div className="text-xl font-semibold mt-1">
                  {monthSummary ? formatCurrencyTRY(monthSummary.revenueToDate) : "—"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {revenueChangePct == null
                    ? "Geçen aya göre kıyas yok"
                    : `${Math.round(revenueChangePct * 100)}% geçen aya göre`}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Hedef Sapması (Ciro)
                </div>
                <div className="text-xl font-semibold mt-1">
                  {monthSummary?.paceDeviation == null
                    ? "—"
                    : `${Math.round(monthSummary.paceDeviation * 100)}%`}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {monthSummary?.paceDeviation == null
                    ? "Hedefin bugüne kadarki payına göre"
                    : monthSummary.paceDeviation >= 0
                      ? "Hedefin üzerindesiniz"
                      : "Hedefin gerisindesiniz"}
                  {projectedDeviation != null && (
                    <span className="ml-2">
                      • Ay sonu: {Math.round(projectedDeviation * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Hedefe Kalan Ciro
                </div>
                <div className="text-xl font-semibold mt-1">
                  {monthSummary
                    ? formatCurrencyTRY(remainingToTarget)
                    : "—"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Günlük gereken:{" "}
                  {monthSummary ? formatCurrencyTRY(requiredDailyRevenue) : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  ROI Hedef Sapması
                </div>
                <div className="text-xl font-semibold mt-1">
                  {roiDeviation == null ? "—" : `${Math.round(roiDeviation * 100)}%`}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  ROI (Ay):{" "}
                  {monthSummary?.roiToDate == null
                    ? "—"
                    : formatNumber(monthSummary.roiToDate)}
                </div>
              </div>
            </div>

            {editingTargets && (
              <div className="lg:col-span-3 rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4">
                <div className="grid gap-3 md:grid-cols-3 items-end">
                  <label className="block">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Aylık Ciro Hedefi (₺)
                    </span>
                    <Input
                      type="number"
                      step="1"
                      value={targets.revenueTarget}
                      onChange={(e) =>
                        setTargets((t) => ({
                          ...t,
                          revenueTarget: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ROI/ROAS Hedefi
                    </span>
                    <Input
                      type="number"
                      step="0.1"
                      value={targets.roiTarget}
                      onChange={(e) =>
                        setTargets((t) => ({
                          ...t,
                          roiTarget: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Hedefler şimdilik tarayıcıda saklanır (localStorage). Son aşamada
                    Supabase’e taşınacak.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <AdSpendBreakdown rows={platformRows} />
      </section>

      <BudgetWidgets month={monthSummary} />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActionCenter items={actions} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Durum Özeti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>Ay ROI</span>
              <span className="font-medium tabular-nums">
                {monthSummary?.roiToDate == null ? "—" : formatNumber(monthSummary.roiToDate)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ay Harcama</span>
              <span className="font-medium tabular-nums">
                {monthSummary ? formatCurrencyTRY(monthSummary.adSpendToDate) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ay sonu hedef sapması</span>
              <span className="font-medium tabular-nums">
                {projectedDeviation == null ? "—" : `${Math.round(projectedDeviation * 100)}%`}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Net Kâr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {netProfit == null ? "—" : formatCurrencyTRY(netProfit)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MVP: COGS `order_items` + `products.cogs` üzerinden hesaplanır. Komisyon/kargo maliyeti sonraki adım.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ROAS</CardTitle>
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
            <CardTitle>MER</CardTitle>
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

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Toplam Sipariş</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{rangeTotals.tx}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Seçili aralık
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ort. Sepet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {rangeTotals.aov == null ? "—" : formatCurrencyTRY(rangeTotals.aov)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Seçili aralık
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Toplam Harcama</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCurrencyTRY(rangeTotals.spend)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Reklam harcaması
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>COS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {rangeTotals.cos == null ? "—" : `${formatNumber(rangeTotals.cos * 100)}%`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              COS = Harcama / Ciro
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Gelir & Net Kâr</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {dateRange.preset.toUpperCase()}
                </Badge>
                <div className="flex rounded-md border border-slate-200/70 dark:border-slate-800/70 p-1 bg-white/40 dark:bg-slate-950/30 backdrop-blur">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={chartMode === "profit" ? "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950" : "h-7 px-2.5 text-xs"}
                    onClick={() => setChartMode("profit")}
                  >
                    Kâr
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={chartMode === "cost" ? "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950" : "h-7 px-2.5 text-xs"}
                    onClick={() => setChartMode("cost")}
                  >
                    Maliyet
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "rgba(100,116,139,0.9)" }}
                    tickFormatter={(v) => String(v).slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "rgba(100,116,139,0.9)" }}
                    tickFormatter={(v) => formatCompact(Number(v))}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: string) => {
                      const v = Number(value ?? 0);
                      if (name === "revenue") return [formatCurrencyTRY(v), "Gelir"];
                      if (name === "netProfit") return [formatCurrencyTRY(v), "Net Kâr"];
                      if (name === "adSpend") return [formatCurrencyTRY(v), "Reklam"];
                      if (name === "cogs") return [formatCurrencyTRY(v), "COGS"];
                      return [formatCurrencyTRY(v), name];
                    }}
                    labelFormatter={(label) => `Tarih: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                  />
                  {chartMode === "profit" ? (
                    <Line
                      type="monotone"
                      dataKey="netProfit"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : (
                    <>
                      <Line
                        type="monotone"
                        dataKey="adSpend"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cogs"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Brüt Satış</span>
                <span className="font-medium">{formatCurrencyTRY(summary!.grossSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">COGS</span>
                <span className="font-medium">{formatCurrencyTRY(summary!.cogsTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">Reklam</span>
                <span className="font-medium">{formatCurrencyTRY(summary!.adSpend)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Envanter Uyarıları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">Kritik</span>
              <Badge variant={alerts.critical > 0 ? "danger" : "success"}>
                {alerts.critical}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">Overstock</span>
              <Badge variant={alerts.overstock > 0 ? "warning" : "success"}>
                {alerts.overstock}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-300">DNR</span>
              <Badge variant={alerts.dnr > 0 ? "warning" : "success"}>
                {alerts.dnr}
              </Badge>
            </div>
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              Toplam ürün: {alerts.total}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>En Karlı Ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-200/70 dark:border-slate-800/70">
                    <th className="px-3 py-3 text-left font-semibold">SKU</th>
                    <th className="px-3 py-3 text-left font-semibold">Ürün</th>
                    <th className="px-3 py-3 text-right font-semibold">Adet</th>
                    <th className="px-3 py-3 text-right font-semibold">Gelir</th>
                    <th className="px-3 py-3 text-right font-semibold">Kâr</th>
                    <th className="px-3 py-3 text-right font-semibold">Marj</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.map((r) => (
                    <tr
                      key={r.sku}
                      className="border-b border-slate-200/70 dark:border-slate-800/70"
                    >
                      <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {r.sku}
                      </td>
                      <td className="px-3 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{r.units}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrencyTRY(r.revenue)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatCurrencyTRY(r.profit)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.margin == null
                          ? "—"
                          : `${formatNumber(r.margin * 100)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topProductsQuery.isLoading && (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Ürün kârlılığı hesaplanıyor…
              </div>
            )}
            {topRows.length === 0 && !topProductsQuery.isLoading && (
              <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                Bu aralıkta ürün satışı bulunamadı.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pazaryeri / Kanal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Ödendi siparişlerde ciro payı (seçili aralık)
            </div>
            {channelBreakdown.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Veri yok.
              </div>
            ) : (
              <div className="space-y-2">
                {channelBreakdown.map((r) => (
                  <div key={r.channel} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate text-slate-900 dark:text-slate-100">
                        {channelLabel(r.channel)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {r.orders} sipariş
                        {r.share == null ? "" : ` • ${Math.round(r.share * 100)}%`}
                      </div>
                    </div>
                    <div className="tabular-nums font-medium">
                      {formatCurrencyTRY(r.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <MetricsTable rows={(dailyMetricsQuery.data ?? []).slice(-30)} />
      </section>
    </div>
  );
}
