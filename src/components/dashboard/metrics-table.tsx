"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyMetricsRow } from "@/lib/queries/dashboard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

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

function heat(value: number | null, kind: "goodHigh" | "goodLow") {
  if (value == null || !Number.isFinite(value)) return "";
  // Basit normalize: ROI 1..20, COS 0..0.3
  const t =
    kind === "goodHigh"
      ? Math.max(0, Math.min(1, (value - 1) / 10))
      : Math.max(0, Math.min(1, (0.25 - value) / 0.25));
  const alpha = 0.12 + t * 0.22;
  const bg =
    kind === "goodHigh"
      ? `rgba(16,185,129,${alpha})`
      : `rgba(244,63,94,${alpha})`;
  return bg;
}

export function MetricsTable({ rows }: { rows: DailyMetricsRow[] }) {
  const [view, setView] = useState<"daily" | "monthly">("daily");

  const platformColumns = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r.platform ?? {})) set.add(k);
    }
    return Array.from(set.values()).slice(0, 4);
  }, [rows]);

  const viewRows = useMemo(() => {
    if (view === "daily") return rows;

    const map = new Map<
      string,
      {
        revenue: number;
        tx: number;
        spend: number;
        platform: Record<string, number>;
      }
    >();

    for (const r of rows) {
      const month = r.date.slice(0, 7);
      const prev = map.get(month) ?? {
        revenue: 0,
        tx: 0,
        spend: 0,
        platform: {},
      };
      prev.revenue += r.revenue;
      prev.tx += r.transactions;
      prev.spend += r.adSpend;
      for (const [k, v] of Object.entries(r.platform ?? {})) {
        prev.platform[k] = (prev.platform[k] ?? 0) + Number(v ?? 0);
      }
      map.set(month, prev);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => {
        const aov = v.tx > 0 ? v.revenue / v.tx : null;
        const cos = v.revenue > 0 ? v.spend / v.revenue : null;
        const roi = v.spend > 0 ? v.revenue / v.spend : null;
        return {
          date: month,
          revenue: v.revenue,
          transactions: v.tx,
          aov,
          adSpend: v.spend,
          cos,
          roi,
          platform: v.platform,
        } satisfies DailyMetricsRow;
      });
  }, [rows, view]);

  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
  const totalSpend = rows.reduce((a, r) => a + r.adSpend, 0);
  const totalTx = rows.reduce((a, r) => a + r.transactions, 0);
  const aov = totalTx > 0 ? totalRevenue / totalTx : null;
  const roi = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const cos = totalRevenue > 0 ? totalSpend / totalRevenue : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Metrikler</CardTitle>
          <div className="flex rounded-md border border-slate-200/70 dark:border-slate-800/70 p-1 bg-white/40 dark:bg-slate-950/30 backdrop-blur">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-2.5 text-xs",
                view === "daily" &&
                  "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950"
              )}
              onClick={() => setView("daily")}
            >
              Günlük
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-2.5 text-xs",
                view === "monthly" &&
                  "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950"
              )}
              onClick={() => setView("monthly")}
            >
              Aylık
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200/70 dark:border-slate-800/70">
                <th className="px-3 py-3 text-left font-semibold">Tarih</th>
                <th className="px-3 py-3 text-right font-semibold">Ciro</th>
                <th className="px-3 py-3 text-right font-semibold">Sipariş</th>
                <th className="px-3 py-3 text-right font-semibold">Ort. Sepet</th>
                <th className="px-3 py-3 text-right font-semibold">Reklam</th>
                <th className="px-3 py-3 text-right font-semibold">COS</th>
                <th className="px-3 py-3 text-right font-semibold">ROI</th>
                {platformColumns.map((p) => (
                  <th key={p} className="px-3 py-3 text-right font-semibold">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-950/20">
                <td className="px-3 py-3 font-semibold">TOPLAM</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {formatCurrencyTRY(totalRevenue)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {totalTx}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {aov == null ? "—" : formatCurrencyTRY(aov)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {formatCurrencyTRY(totalSpend)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {cos == null ? "—" : `${formatNumber(cos * 100)}%`}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">
                  {roi == null ? "—" : formatNumber(roi)}
                </td>
                {platformColumns.map((p) => (
                  <td
                    key={p}
                    className="px-3 py-3 text-right font-semibold tabular-nums"
                  >
                    {formatCurrencyTRY(
                      rows.reduce((acc, r) => acc + Number(r.platform?.[p] ?? 0), 0)
                    )}
                  </td>
                ))}
              </tr>

              {viewRows.map((r) => (
                <tr
                  key={r.date}
                  className={cn(
                    "border-b border-slate-200/70 dark:border-slate-800/70"
                  )}
                >
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                    {r.date}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrencyTRY(r.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.transactions}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.aov == null ? "—" : formatCurrencyTRY(r.aov)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrencyTRY(r.adSpend)}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    style={{ background: heat(r.cos, "goodLow") }}
                  >
                    {r.cos == null ? "—" : `${formatNumber(r.cos * 100)}%`}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums"
                    style={{ background: heat(r.roi, "goodHigh") }}
                  >
                    {r.roi == null ? "—" : formatNumber(r.roi)}
                  </td>
                  {platformColumns.map((p) => {
                    const v = Number(r.platform?.[p] ?? 0);
                    const pct = r.adSpend > 0 ? v / r.adSpend : 0;
                    return (
                      <td key={p} className="px-3 py-3 text-right tabular-nums">
                        {formatCurrencyTRY(v)}{" "}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ({Math.round(pct * 100)}%)
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
