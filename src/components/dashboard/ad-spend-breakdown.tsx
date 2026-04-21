"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrencyTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdSpendBreakdown({
  rows,
}: {
  rows: Array<{ platform: string; spend: number }>;
}) {
  const total = rows.reduce((acc, r) => acc + (Number.isFinite(r.spend) ? r.spend : 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reklam Harcaması Dağılımı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="text-sm text-slate-600 dark:text-slate-300">Toplam</div>
          <div className="text-lg font-semibold">{formatCurrencyTRY(total)}</div>
        </div>

        <div className="space-y-3">
          {rows.map((r) => {
            const pct = total > 0 ? r.spend / total : 0;
            return (
              <div key={r.platform} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="text-slate-600 dark:text-slate-300">{r.platform}</div>
                  <div className="text-slate-600 dark:text-slate-300 tabular-nums">
                    {formatCurrencyTRY(r.spend)} ({Math.round(pct * 100)}%)
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200/60 dark:bg-slate-800/60 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.round(pct * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Bu aralıkta harcama yok.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

