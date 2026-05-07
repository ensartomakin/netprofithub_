"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthSummary } from "@/lib/queries/dashboard";

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

export function BudgetWidgets({ month }: { month: MonthSummary | null | undefined }) {
  const revenueTarget = month?.target.revenueTarget ?? 0;
  const roiTarget = month?.target.roiTarget ?? 0;
  const spendTarget = roiTarget > 0 ? revenueTarget / roiTarget : null;

  const spendToDate = month?.adSpendToDate ?? 0;
  const daysLeft =
    month ? Math.max(1, month.daysInMonth - month.daysElapsed) : 1;
  const remainingBudget =
    spendTarget == null ? null : Math.max(0, spendTarget - spendToDate);
  const dailyBudget =
    remainingBudget == null ? null : remainingBudget / daysLeft;

  const targetCos = roiTarget > 0 ? 1 / roiTarget : null;

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle>Hedef Bütçe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium tabular-nums text-charcoal-text">
            {spendTarget == null ? "—" : formatCurrencyTRY(spendTarget)}
          </div>
          <div className="text-xs text-dark-overlay mt-1">
            Hedef Bütçe = Hedef Ciro / Hedef ROI
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hedefe Kalan Bütçe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium tabular-nums text-charcoal-text">
            {remainingBudget == null ? "—" : formatCurrencyTRY(remainingBudget)}
          </div>
          <div className="text-xs text-dark-overlay mt-1">
            Bugüne kadar: {formatCurrencyTRY(spendToDate)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Günlük Bütçe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium tabular-nums text-charcoal-text">
            {dailyBudget == null ? "—" : formatCurrencyTRY(dailyBudget)}
          </div>
          <div className="text-xs text-dark-overlay mt-1">
            Kalan gün: {month ? daysLeft : "—"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hedef COS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium tabular-nums text-charcoal-text">
            {targetCos == null ? "—" : `${formatNumber(targetCos * 100)}%`}
          </div>
          <div className="text-xs text-dark-overlay mt-1">
            COS = Harcama / Ciro
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

