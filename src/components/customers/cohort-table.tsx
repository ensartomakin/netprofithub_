"use client";

import { useMemo } from "react";
import { TD, TH, THead, TRow } from "@/components/ui/table";
import type { CohortRow } from "@/lib/queries/customer-analytics";
import { cn } from "@/lib/utils";

function formatPercentTR(pct: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(pct);
}

function formatCurrencyTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function cellBg(intensity: number) {
  // intensity 0..1
  const i = clamp(intensity, 0, 1);
  // Use emerald scale with alpha so it works in light/dark.
  // 0 -> transparent, 1 -> strong.
  const a = 0.08 + i * 0.32;
  return {
    background: `rgba(16, 185, 129, ${a})`,
    borderColor: `rgba(16, 185, 129, ${0.15 + i * 0.35})`,
  } as const;
}

export function CohortTable({
  rows,
  mode,
}: {
  rows: CohortRow[];
  mode: "retention" | "ltv";
}) {
  const maxOffset = useMemo(() => {
    let max = 0;
    for (const r of rows) max = Math.max(max, r.cells.length - 1);
    return max;
  }, [rows]);

  const maxLtv = useMemo(() => {
    if (mode !== "ltv") return 0;
    let max = 0;
    for (const r of rows) {
      for (const c of r.cells) {
        max = Math.max(max, Number(c.ltvPerCustomer ?? 0));
      }
    }
    return max;
  }, [mode, rows]);

  const headers = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  return (
    <div className="overflow-auto rounded-xl border border-slate-200/70 dark:border-slate-800/70">
      <table className="w-full text-sm">
        <THead>
          <TRow className="border-b-0">
            <TH>Kohort</TH>
            <TH className="text-right">Müşteri</TH>
            {headers.map((i) => (
              <TH key={i} className="text-right">{`M+${i}`}</TH>
            ))}
          </TRow>
        </THead>
        <tbody>
          {rows.map((r) => (
            <TRow key={r.cohortMonth}>
              <TD className="font-medium whitespace-nowrap">{r.cohortMonth}</TD>
              <TD className="text-right tabular-nums">{r.cohortSize}</TD>
              {headers.map((i) => {
                const cell = r.cells[i];
                if (!cell) {
                  return (
                    <TD key={i} className="text-right text-slate-400">
                      —
                    </TD>
                  );
                }

                const value =
                  mode === "retention" ? cell.retentionPct : cell.ltvPerCustomer;

                const intensity =
                  mode === "retention"
                    ? Number(cell.retentionPct ?? 0)
                    : maxLtv > 0
                      ? Number(cell.ltvPerCustomer ?? 0) / maxLtv
                      : 0;

                const style = cellBg(intensity);

                return (
                  <TD
                    key={i}
                    className={cn(
                      "text-right tabular-nums",
                      "border border-transparent"
                    )}
                    style={style}
                    title={
                      mode === "retention"
                        ? `Aktif: ${cell.activeCustomers}/${r.cohortSize}`
                        : `Kümülatif LTV: ${cell.ltvPerCustomer == null ? "—" : formatCurrencyTRY(cell.ltvPerCustomer)}`
                    }
                  >
                    {value == null
                      ? "—"
                      : mode === "retention"
                        ? formatPercentTR(value)
                        : formatCurrencyTRY(value)}
                  </TD>
                );
              })}
            </TRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}
