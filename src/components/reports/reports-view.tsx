"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchDashboardSummary } from "@/lib/queries/metrics";
import { fetchOrders } from "@/lib/queries/orders";
import { fetchProducts } from "@/lib/queries/products";
import { fetchExpenses } from "@/lib/queries/expenses";
import { fetchMarketingSpend } from "@/lib/queries/marketing";
import { fetchDashboardTimeseries } from "@/lib/queries/dashboard";
import { fetchReturnsBySku, fetchReturnsTimeseries } from "@/lib/queries/returns";
import { fetchCustomerAnalytics } from "@/lib/queries/customer-analytics";
import { downloadCsv, toCsv } from "@/lib/csv";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";

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

function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

export function ReportsView() {
  const { storeId, dateRange } = useAppState();
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

  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () =>
      fetchOrders({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const productsQuery = useQuery({
    queryKey: ["products", storeId],
    queryFn: () => fetchProducts({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => fetchExpenses({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
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

  const returnsSkuQuery = useQuery({
    queryKey: ["returnsBySku", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () =>
      fetchReturnsBySku({ storeId: storeId!, from: dateRange.from, to: dateRange.to, limit: 200 }),
    enabled: Boolean(storeId),
  });

  const returnsSeriesQuery = useQuery({
    queryKey: ["returnsSeries", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => fetchReturnsTimeseries({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const customersQuery = useQuery({
    queryKey: [
      "customerAnalytics",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      12,
    ],
    queryFn: () =>
      fetchCustomerAnalytics({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        maxMonths: 12,
      }),
    enabled: Boolean(storeId),
  });

  const campaignAttribution = useMemo(() => {
    const spends = spendQuery.data ?? [];
    const series = seriesQuery.data ?? [];
    if (!storeId) return [];
    if (spends.length === 0 || series.length === 0) return [];

    const dayTotals = new Map<string, { revenue: number; profit: number }>();
    for (const p of series) {
      dayTotals.set(p.date, { revenue: p.revenue, profit: p.netProfit });
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
        } satisfies { platform: string; campaign: string; spend: number; revenue: number; profit: number });

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
      .sort((a, b) => b.profit - a.profit);
  }, [seriesQuery.data, spendQuery.data, storeId]);

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

  if (
    summaryQuery.isLoading ||
    ordersQuery.isLoading ||
    productsQuery.isLoading ||
    expensesQuery.isLoading
  ) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">Raporlar hazırlanıyor…</div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Rapor verileri alınamadı.
        </CardContent>
      </Card>
    );
  }

  const summary = summaryQuery.data!;
  const roas = safeDivide(summary.grossSales, summary.adSpend);
  const mer = safeDivide(summary.adSpend, summary.grossSales);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Brüt Satış</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(summary.grossSales)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Seçili aralık</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reklam</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(summary.adSpend)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Toplam harcama</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ROAS / MER</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {roas == null ? "—" : `${formatNumber(roas)}x`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              MER: {mer == null ? "—" : formatNumber(mer)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Export Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Sipariş</span>
              <Badge variant={ordersQuery.data?.length ? "success" : "default"}>
                {ordersQuery.data?.length ?? 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Ürün</span>
              <Badge variant={productsQuery.data?.length ? "success" : "default"}>
                {productsQuery.data?.length ?? 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Gider</span>
              <Badge variant={expensesQuery.data?.length ? "success" : "default"}>
                {expensesQuery.data?.length ?? 0}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CSV Export Merkezi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Entegrasyon/gerçek veri çekme hariç: mevcut dummy verileri raporlamak için kullanılabilir.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (ordersQuery.data ?? []).map((o) => ({
                    id: o.id,
                    customer_id: o.customer_id ?? "",
                    status: o.status,
                    amount_try: Math.round(o.amount),
                    tax_try: Math.round(o.tax),
                    shipping_try: Math.round(o.shipping),
                    ordered_at: o.ordered_at,
                  }));
                  downloadCsv("netprofithub_siparisler.csv", toCsv(rows));
                }}
                disabled={!ordersQuery.data?.length}
              >
                Siparişler CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (productsQuery.data ?? []).map((p) => ({
                    sku: p.sku,
                    name: p.name,
                    cogs_try: Math.round(p.cogs),
                    stock_level: p.stock_level,
                    velocity: p.velocity,
                    dnr: p.dnr ? "evet" : "hayir",
                    status: p.status,
                  }));
                  downloadCsv("netprofithub_urunler.csv", toCsv(rows));
                }}
                disabled={!productsQuery.data?.length}
              >
                Ürünler CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (expensesQuery.data ?? []).map((e) => ({
                    effective_date: e.effective_date,
                    category: e.category,
                    amount_try: Math.round(e.amount),
                    recurring: e.recurring_status ? "evet" : "hayir",
                  }));
                  downloadCsv("netprofithub_giderler.csv", toCsv(rows));
                }}
                disabled={!expensesQuery.data?.length}
              >
                Giderler CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (seriesQuery.data ?? []).map((p) => ({
                    date: p.date,
                    revenue_try: Math.round(p.revenue),
                    ad_spend_try: Math.round(p.adSpend),
                    cogs_try: Math.round(p.cogs),
                    net_profit_try: Math.round(p.netProfit),
                  }));
                  downloadCsv("netprofithub_pnl_gunluk_trend.csv", toCsv(rows));
                }}
                disabled={!seriesQuery.data?.length}
              >
                P&L Trend CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gelişmiş Export’lar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
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
                  downloadCsv("netprofithub_kampanya_net_kar_atfi.csv", toCsv(rows));
                }}
                disabled={!campaignAttribution.length}
              >
                Kampanya Atfı CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (returnsSkuQuery.data ?? []).map((r) => ({
                    sku: r.sku,
                    name: r.name,
                    returned_units: r.returnedUnits,
                    return_rate: r.returnRate == null ? "" : Math.round(r.returnRate * 1000) / 1000,
                    returned_revenue_try: Math.round(r.returnedRevenue),
                  }));
                  downloadCsv("netprofithub_iade_sku.csv", toCsv(rows));
                }}
                disabled={!returnsSkuQuery.data?.length}
              >
                İade SKU CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rows = (returnsSeriesQuery.data ?? []).map((r) => ({
                    date: r.date,
                    returned_units: r.returnedUnits,
                    returned_revenue_try: Math.round(r.returnedRevenue),
                  }));
                  downloadCsv("netprofithub_iade_trend.csv", toCsv(rows));
                }}
                disabled={!returnsSeriesQuery.data?.length}
              >
                İade Trend CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const rep = customersQuery.data?.repurchase;
                  const rows = [
                    {
                      customers: rep?.customers ?? 0,
                      repeat2_pct: rep?.repeat2Pct == null ? "" : Math.round(rep.repeat2Pct * 1000) / 1000,
                      repeat3_pct: rep?.repeat3Pct == null ? "" : Math.round(rep.repeat3Pct * 1000) / 1000,
                      repeat4_pct: rep?.repeat4Pct == null ? "" : Math.round(rep.repeat4Pct * 1000) / 1000,
                    },
                  ];
                  downloadCsv("netprofithub_repurchase.csv", toCsv(rows));
                }}
                disabled={!customersQuery.data?.repurchase}
              >
                Repurchase CSV
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const cohorts = customersQuery.data?.cohorts ?? [];
                  const flat = cohorts.flatMap((r) =>
                    r.cells.map((c) => ({
                      cohort_month: r.cohortMonth,
                      cohort_size: r.cohortSize,
                      month_offset: c.monthOffset,
                      active_customers: c.activeCustomers,
                      retention_pct: c.retentionPct == null ? "" : Math.round(c.retentionPct * 1000) / 1000,
                      revenue_try: Math.round(c.revenue),
                      ltv_per_customer_try: c.ltvPerCustomer == null ? "" : Math.round(c.ltvPerCustomer),
                    }))
                  );
                  downloadCsv("netprofithub_cohort_triangle.csv", toCsv(flat));
                }}
                disabled={!customersQuery.data?.cohorts?.length}
              >
                Cohort CSV
              </Button>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Not: Kampanya atfı bu aşamada simülasyondur (harcama payı). Gerçek UTM/attribution entegrasyonla gelecektir.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

