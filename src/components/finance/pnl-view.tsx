"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { fetchDashboardSummary } from "@/lib/queries/metrics";
import { calculateNetProfit } from "@/lib/trueprofit";
import { createExpense, deleteExpense, fetchExpenses } from "@/lib/queries/expenses";
import { fetchDashboardTimeseries } from "@/lib/queries/dashboard";
import { fetchDailyMetrics } from "@/lib/queries/dashboard";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";
import { downloadCsv, toCsv } from "@/lib/csv";
import { toLocalISODate } from "@/lib/date";
import {
  Bar,
  BarChart,
  CartesianGrid,
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

function toIsoDate(d: Date) {
  return toLocalISODate(d);
}

export function PnlView() {
  const { storeId, dateRange } = useAppState();
  const qc = useQueryClient();
  const { overrides, setOverrides, reset } = useProfitOverrides(storeId);

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

  const expensesQuery = useQuery({
    queryKey: [
      "expenses",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
    ],
    queryFn: () =>
      fetchExpenses({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const [newCategory, setNewCategory] = useState("Sabit Giderler");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDate, setNewDate] = useState(() => toIsoDate(new Date()));
  const [newRecurring, setNewRecurring] = useState(false);

  const createMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
  });

  const expenseByCategory = useMemo(() => {
    const rows = expensesQuery.data ?? [];
    const map = new Map<string, number>();
    for (const e of rows) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expensesQuery.data]);

  const chartPoints = useMemo(() => {
    const pts = seriesQuery.data ?? [];
    return pts.map((p) => ({
      date: p.date,
      label: shortDate(p.date),
      grossSales: p.revenue,
      cogs: p.cogs,
      adSpend: p.adSpend,
      netProfit: p.netProfit,
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

  if (
    summaryQuery.isLoading ||
    expensesQuery.isLoading ||
    seriesQuery.isLoading ||
    dailyQuery.isLoading
  ) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Finans verileri yükleniyor…
      </div>
    );
  }

  if (
    summaryQuery.isError ||
    expensesQuery.isError ||
    seriesQuery.isError ||
    dailyQuery.isError
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          P&amp;L verileri alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  const s = summaryQuery.data!;
  const tx = (dailyQuery.data ?? []).reduce((acc, r) => acc + Number(r.transactions ?? 0), 0);
  const shippingCost = tx * overrides.shippingCostPerOrder;
  const marketplaceFees = s.grossSales * overrides.marketplaceFeeRate;
  const returnCosts = Math.abs(s.returns) * overrides.returnCostRate;
  const netProfit = calculateNetProfit({
    grossSales: s.grossSales,
    cogs: s.cogsTotal,
    shipping: shippingCost,
    adSpend: s.adSpend,
    marketplaceFees,
    returns: s.returns,
    returnCosts,
    fixedExpenses: s.expensesTotal,
  });

  const pnlRows = [
    { label: "Brüt Satış", value: s.grossSales },
    { label: "İadeler", value: -Math.abs(s.returns) },
    { label: "İade Maliyeti (tahmini)", value: -Math.abs(returnCosts) },
    { label: "COGS (MVP)", value: -Math.abs(s.cogsTotal) },
    { label: "Reklam Harcaması", value: -Math.abs(s.adSpend) },
    { label: "Kargo (tahmini)", value: -Math.abs(shippingCost) },
    { label: "Pazaryeri Komisyonu (tahmini)", value: -Math.abs(marketplaceFees) },
    { label: "Sabit Giderler", value: -Math.abs(s.expensesTotal) },
    { label: "Net Kâr", value: netProfit },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Net Kâr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(netProfit)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              True Profit (MVP) — komisyon/kargo detayları genişletilecek
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Brüt Satış</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(s.grossSales)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Seçili tarih aralığı
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reklam</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(s.adSpend)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Google/Meta/TikTok/Pinterest (dummy)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sabit Gider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(s.expensesTotal)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              `expenses` tablosu + demo girişleri
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Günlük Trend (Ciro / Maliyet / Net)</CardTitle>
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
                  const csv = toCsv(rows);
                  downloadCsv("netprofithub_pnl_gunluk_trend.csv", csv);
                }}
              >
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPoints}>
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
                    const label =
                      name === "grossSales"
                        ? "Ciro"
                        : name === "adSpend"
                          ? "Reklam"
                          : name === "cogs"
                            ? "COGS"
                            : "Net Kâr";
                    return [formatCurrencyTRY(v), label];
                  }}
                />
                <Bar dataKey="grossSales" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                <Bar dataKey="adSpend" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cogs" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="netProfit" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>P&amp;L Özeti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {pnlRows.map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span>{r.label}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrencyTRY(r.value)}
                </span>
              </div>
            ))}
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              Not: Pazaryeri komisyonu/kargo iade maliyeti gibi kalemler sonraki adımda detaylanacak.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profit Ayarları (MVP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Kargo Maliyeti / Sipariş (₺)
              </span>
              <Input
                type="number"
                step="1"
                value={overrides.shippingCostPerOrder}
                onChange={(e) => setOverrides({ shippingCostPerOrder: Number(e.target.value || 0) })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Pazaryeri Komisyon Oranı (%)
              </span>
              <Input
                type="number"
                step="0.1"
                value={Math.round(overrides.marketplaceFeeRate * 1000) / 10}
                onChange={(e) =>
                  setOverrides({ marketplaceFeeRate: Number(e.target.value || 0) / 100 })
                }
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                İade Maliyeti Oranı (%)
              </span>
              <Input
                type="number"
                step="0.1"
                value={Math.round(overrides.returnCostRate * 1000) / 10}
                onChange={(e) => setOverrides({ returnCostRate: Number(e.target.value || 0) / 100 })}
              />
            </label>
            <div className="flex items-end justify-end">
              <Button type="button" variant="secondary" onClick={reset}>
                Varsayılan
              </Button>
            </div>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Bu ayarlar tarayıcıda saklanır (localStorage). Supabase’e kaydetme en son aşamada açılacak.
            {" "}Gerçek kargo/komisyon kalemleri entegrasyonlar tamamlandığında API’den çekilecek.
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Giderler</CardTitle>
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
                  const csv = toCsv(rows);
                  downloadCsv("netprofithub_giderler.csv", csv);
                }}
              >
                CSV İndir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Kategori</span>
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Örn: Kira" />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Tutar (₺)</span>
                <Input
                  type="number"
                  step="1"
                  value={Number.isFinite(newAmount) ? newAmount : 0}
                  onChange={(e) => setNewAmount(Number(e.target.value || 0))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Tarih</span>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </label>
              <label className="flex items-end gap-2">
                <input
                  type="checkbox"
                  checked={newRecurring}
                  onChange={(e) => setNewRecurring(e.target.checked)}
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Tekrarlı</span>
              </label>
            </div>

            <div className="flex items-center justify-end">
              <Button
                type="button"
                onClick={() =>
                  createMutation.mutate({
                    storeId: storeId!,
                    category: newCategory.trim() || "Sabit Giderler",
                    amount: Number(newAmount ?? 0),
                    effective_date: newDate,
                    recurring_status: newRecurring,
                  })
                }
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Ekleniyor…" : "Gider Ekle"}
              </Button>
            </div>

            {(createMutation.isError || deleteMutation.isError) && (
              <div className="text-sm text-rose-700 dark:text-rose-200">
                {(createMutation.error instanceof Error && createMutation.error.message) ||
                  (deleteMutation.error instanceof Error && deleteMutation.error.message) ||
                  "İşlem başarısız."}
              </div>
            )}

            <Table>
              <THead>
                <TRow className="border-b-0">
                  <TH>Tarih</TH>
                  <TH>Kategori</TH>
                  <TH className="text-right">Tutar</TH>
                  <TH>Durum</TH>
                  <TH className="text-right"> </TH>
                </TRow>
              </THead>
              <tbody>
                {(expensesQuery.data ?? []).slice(0, 30).map((e) => (
                  <TRow key={e.id}>
                    <TD className="tabular-nums">{e.effective_date}</TD>
                    <TD className="font-medium">{e.category}</TD>
                    <TD className="text-right tabular-nums">{formatCurrencyTRY(e.amount)}</TD>
                    <TD>
                      {e.recurring_status ? (
                        <Badge variant="warning">Tekrarlı</Badge>
                      ) : (
                        <Badge variant="default">Tek Sefer</Badge>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ storeId: storeId!, id: e.id })}
                        disabled={deleteMutation.isPending}
                      >
                        Sil
                      </Button>
                    </TD>
                  </TRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kategori Kırılımı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.map((x) => (
              <div key={x.category} className="flex items-center justify-between text-sm">
                <div className="text-slate-600 dark:text-slate-300">{x.category}</div>
                <div className="font-medium tabular-nums">{formatCurrencyTRY(x.amount)}</div>
              </div>
            ))}
            {expenseByCategory.length === 0 && (
              <div className="text-sm text-slate-600 dark:text-slate-300">Gider yok.</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
