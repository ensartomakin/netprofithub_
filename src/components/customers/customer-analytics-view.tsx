"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CohortTable } from "@/components/customers/cohort-table";
import { fetchCustomerAnalytics } from "@/lib/queries/customer-analytics";
import { downloadCsv, toCsv } from "@/lib/csv";

function formatPercent(p: number) {
  return new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 }).format(
    p
  );
}

export function CustomerAnalyticsView() {
  const { storeId, dateRange } = useAppState();
  const [mode, setMode] = useState<"retention" | "ltv">("retention");
  const [months, setMonths] = useState(6);

  const query = useQuery({
    queryKey: [
      "customerAnalytics",
      storeId,
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      months,
    ],
    queryFn: () =>
      fetchCustomerAnalytics({
        storeId: storeId!,
        from: dateRange.from,
        to: dateRange.to,
        maxMonths: months,
      }),
    enabled: Boolean(storeId),
  });

  const cohortRows = useMemo(() => query.data?.cohorts ?? [], [query.data?.cohorts]);
  const rep = query.data?.repurchase;

  const lastCohort = useMemo(() => cohortRows[cohortRows.length - 1] ?? null, [cohortRows]);
  const lastM1 = lastCohort?.cells?.[1]?.retentionPct ?? null;

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

  if (query.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Müşteri analitiği yükleniyor…
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Müşteri analitiği alınamadı. (orders.customer_id alanını kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Cohort Analizi</CardTitle>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                MVP notu: İlk satın alma kohortu seçili tarih aralığından türetilir (tam “all-time” cohort son adımda).
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default">Beta</Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const repurchaseRows = [
                    {
                      customers: rep?.customers ?? 0,
                      repeat2_pct: rep?.repeat2Pct == null ? "" : Math.round(rep.repeat2Pct * 1000) / 1000,
                      repeat3_pct: rep?.repeat3Pct == null ? "" : Math.round(rep.repeat3Pct * 1000) / 1000,
                      repeat4_pct: rep?.repeat4Pct == null ? "" : Math.round(rep.repeat4Pct * 1000) / 1000,
                    },
                  ];
                  const csv = toCsv(repurchaseRows);
                  downloadCsv("netprofithub_repurchase.csv", csv);
                }}
              >
                CSV İndir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={mode === "retention" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("retention")}
            >
              Tutma (Retention)
            </Button>
            <Button
              type="button"
              variant={mode === "ltv" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("ltv")}
            >
              LTV (Kümülatif)
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Görünüm</span>
            <Button
              type="button"
              variant={months === 3 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMonths(3)}
            >
              3 Ay
            </Button>
            <Button
              type="button"
              variant={months === 6 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMonths(6)}
            >
              6 Ay
            </Button>
            <Button
              type="button"
              variant={months === 12 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMonths(12)}
            >
              12 Ay
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Müşteri (Aralık)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{rep?.customers ?? 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Benzersiz müşteri
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Sipariş</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {rep?.repeat2Pct == null ? "—" : formatPercent(rep.repeat2Pct)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ≥ 2 sipariş
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3. Sipariş</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {rep?.repeat3Pct == null ? "—" : formatPercent(rep.repeat3Pct)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ≥ 3 sipariş
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>4. Sipariş</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {rep?.repeat4Pct == null ? "—" : formatPercent(rep.repeat4Pct)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ≥ 4 sipariş
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Cohort Üçgeni</CardTitle>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Hücre üzerine gelerek detay görebilirsiniz.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Son kohort M+1:{" "}
                <span className="font-medium">
                  {lastM1 == null ? "—" : formatPercent(lastM1)}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const flat = cohortRows.flatMap((r) =>
                    r.cells.map((c) => ({
                      cohort_month: r.cohortMonth,
                      cohort_size: r.cohortSize,
                      month_offset: c.monthOffset,
                      active_customers: c.activeCustomers,
                      retention_pct: c.retentionPct == null ? "" : Math.round(c.retentionPct * 1000) / 1000,
                      revenue_try: Math.round(c.revenue),
                      ltv_per_customer_try:
                        c.ltvPerCustomer == null ? "" : Math.round(c.ltvPerCustomer),
                    }))
                  );
                  const csv = toCsv(flat);
                  downloadCsv("netprofithub_cohort_triangle.csv", csv);
                }}
                disabled={cohortRows.length === 0}
              >
                CSV İndir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cohortRows.length === 0 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Bu aralıkta cohort oluşturmak için yeterli sipariş yok.
            </div>
          ) : (
            <CohortTable rows={cohortRows} mode={mode} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
