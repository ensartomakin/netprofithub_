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
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function heat(value: number | null, kind: "goodHigh" | "goodLow") {
  if (value == null || !Number.isFinite(value)) return "";
  const t =
    kind === "goodHigh"
      ? Math.max(0, Math.min(1, (value - 1) / 10))
      : Math.max(0, Math.min(1, (0.25 - value) / 0.25));
  const alpha = 0.08 + t * 0.18;
  const bg =
    kind === "goodHigh"
      ? `rgba(190,255,80,${alpha})`
      : `rgba(235,49,49,${alpha})`;
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
      { revenue: number; tx: number; spend: number; platform: Record<string, number> }
    >();

    for (const r of rows) {
      const month = r.date.slice(0, 7);
      const prev = map.get(month) ?? { revenue: 0, tx: 0, spend: 0, platform: {} };
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
          <div className="flex rounded-[26px] p-1 bg-parchment-card">
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-3 text-xs rounded-[26px] border-transparent",
                view === "daily" && "bg-near-black text-white hover:bg-near-black"
              )}
              onClick={() => setView("daily")}
            >
              Günlük
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-7 px-3 text-xs rounded-[26px] border-transparent",
                view === "monthly" && "bg-near-black text-white hover:bg-near-black"
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
            <thead className="text-xs uppercase text-graphite">
              <tr className="border-b border-stone">
                <th className="px-3 py-3 text-left font-medium">Tarih</th>
                <th className="px-3 py-3 text-right font-medium">Ciro</th>
                <th className="px-3 py-3 text-right font-medium">Sipariş</th>
                <th className="px-3 py-3 text-right font-medium">Ort. Sepet</th>
                <th className="px-3 py-3 text-right font-medium">Reklam</th>
                <th className="px-3 py-3 text-right font-medium">COS</th>
                <th className="px-3 py-3 text-right font-medium">ROI</th>
                {platformColumns.map((p) => (
                  <th key={p} className="px-3 py-3 text-right font-medium">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Totals row */}
              <tr className="border-b border-stone bg-parchment-card">
                <td className="px-3 py-3 font-medium text-near-black">TOPLAM</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {formatCurrencyTRY(totalRevenue)}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {totalTx}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {aov == null ? "—" : formatCurrencyTRY(aov)}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {formatCurrencyTRY(totalSpend)}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {cos == null ? "—" : `${formatNumber(cos * 100)}%`}
                </td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                  {roi == null ? "—" : formatNumber(roi)}
                </td>
                {platformColumns.map((p) => (
                  <td key={p} className="px-3 py-3 text-right font-medium tabular-nums text-near-black">
                    {formatCurrencyTRY(rows.reduce((acc, r) => acc + Number(r.platform?.[p] ?? 0), 0))}
                  </td>
                ))}
              </tr>

              {viewRows.map((r) => (
                <tr
                  key={r.date}
                  className={cn("border-b border-stone/40 last:border-0")}
                >
                  <td className="px-3 py-3 text-graphite">{r.date}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-near-black">
                    {formatCurrencyTRY(r.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-near-black">
                    {r.transactions}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-near-black">
                    {r.aov == null ? "—" : formatCurrencyTRY(r.aov)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-near-black">
                    {formatCurrencyTRY(r.adSpend)}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums text-near-black"
                    style={{ background: heat(r.cos, "goodLow") }}
                  >
                    {r.cos == null ? "—" : `${formatNumber(r.cos * 100)}%`}
                  </td>
                  <td
                    className="px-3 py-3 text-right tabular-nums text-near-black"
                    style={{ background: heat(r.roi, "goodHigh") }}
                  >
                    {r.roi == null ? "—" : formatNumber(r.roi)}
                  </td>
                  {platformColumns.map((p) => {
                    const v = Number(r.platform?.[p] ?? 0);
                    const pct = r.adSpend > 0 ? v / r.adSpend : 0;
                    return (
                      <td key={p} className="px-3 py-3 text-right tabular-nums text-near-black">
                        {formatCurrencyTRY(v)}{" "}
                        <span className="text-xs text-graphite">
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
