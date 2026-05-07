"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyComparison, type WeeklyComparisonRow } from "@/lib/queries/dashboard";
import { TrendingUp, TrendingDown } from "lucide-react";

function formatTRY(v: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatValue(metric: string, v: number | null) {
  if (v == null) return "—";
  if (metric === "Revenue" || metric === "Cost") return formatTRY(v);
  if (metric === "Conversion Rate")
    return `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat("tr-TR").format(v);
}

const METRIC_LABELS: Record<string, string> = {
  Users: "Users",
  Sessions: "Sessions",
  Cost: "Cost",
  "Conversion Rate": "Conversion Rate",
  Transactions: "Transactions",
  Revenue: "Revenue",
};

function ChangeCell({ change, metric }: { change: number | null; metric: string }) {
  if (change == null)
    return <td className="px-4 py-3 text-right text-dark-overlay text-xs">—</td>;
  const isNegativeGood = metric === "Cost";
  const positive = isNegativeGood ? change <= 0 : change >= 0;
  const pct = `${change >= 0 ? "+" : ""}${(change * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
  return (
    <td className="px-4 py-3 text-right">
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-[8px] ${
          positive ? "bg-[#1dc479]/15 text-[#1dc479]" : "bg-[#eb3131]/10 text-[#eb3131]"
        }`}
      >
        {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {pct}
      </span>
    </td>
  );
}

const STATIC_TRENDS = [
  {
    title: "Verimsiz Trafik Artışı",
    body: "Kullanıcı ve oturum sayılarında artış olmasına rağmen bu trafik satışa etkin şekilde dönüşmemiştir.",
  },
  {
    title: "Dönüşüm Oranında Kritik Düşüş",
    body: "Dönüşüm oranı gerilemiştir. Artan trafiğe rağmen işlem sayısı düşmüştür.",
  },
  {
    title: "Maliyet Optimizasyonu ve Sınırlı ROAS Artışı",
    body: "Pazarlama maliyetleri azalmış olabilir; ancak gelirdeki düşüşü telafi etmek için yetersizdir.",
  },
];

function buildTrends(rows: WeeklyComparisonRow[]) {
  const txRow = rows.find((r) => r.metric === "Transactions");
  const revenueRow = rows.find((r) => r.metric === "Revenue");
  const costRow = rows.find((r) => r.metric === "Cost");
  const items: typeof STATIC_TRENDS = [];
  if (txRow?.change != null && txRow.change < -0.1)
    items.push({ title: "İşlem Sayısında Düşüş", body: `Sipariş sayısı ${Math.abs(Math.round(txRow.change * 100))}% azalmıştır.` });
  if (revenueRow?.change != null && revenueRow.change < -0.05)
    items.push({ title: "Ciro Düşüşü", body: `Ciro geçen haftaya göre ${Math.abs(Math.round(revenueRow.change * 100))}% gerilemiştir.` });
  if (costRow?.change != null && costRow.change > 0.1)
    items.push({ title: "Maliyet Artışı", body: `Pazarlama harcaması ${Math.round(costRow.change * 100)}% artmıştır.` });
  return items.length > 0 ? items : STATIC_TRENDS;
}

export function WeeklyComparisonPanel({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["weeklyComparison", storeId],
    queryFn: () => fetchWeeklyComparison({ storeId }),
    enabled: Boolean(storeId),
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const trends = buildTrends(rows);

  const allRows: WeeklyComparisonRow[] = [
    { metric: "Users", current: null, previous: null, change: null },
    { metric: "Sessions", current: null, previous: null, change: null },
    ...(rows.find((r) => r.metric === "Cost") ? [rows.find((r) => r.metric === "Cost")!] : [{ metric: "Cost", current: null, previous: null, change: null }]),
    { metric: "Conversion Rate", current: null, previous: null, change: null },
    ...(rows.find((r) => r.metric === "Transactions") ? [rows.find((r) => r.metric === "Transactions")!] : [{ metric: "Transactions", current: null, previous: null, change: null }]),
    ...(rows.find((r) => r.metric === "Revenue") ? [rows.find((r) => r.metric === "Revenue")!] : [{ metric: "Revenue", current: null, previous: null, change: null }]),
  ];

  return (
    <div className="flex flex-col gap-5 p-6 rounded-[26px] bg-white h-full overflow-auto">
      {/* Intro */}
      {data ? (
        <p className="text-xs text-dark-overlay leading-relaxed">
          <span className="font-medium text-charcoal-text">{data.currentDate}</span>{" "}
          tarihine ait veriler, geçen haftanın aynı günü{" "}
          <span className="font-medium text-charcoal-text">({data.previousDate})</span>{" "}
          ile karşılaştırılmıştır.
        </p>
      ) : (
        <p className="text-xs text-dark-overlay">Yükleniyor…</p>
      )}

      {/* Comparison table — warm-gray surface */}
      <div>
        <h3 className="text-xs font-medium text-dark-overlay tracking-[0.08em] uppercase mb-3">
          Genel Performans Değerlendirmesi
        </h3>
        <div className="overflow-auto rounded-xl bg-warm-gray">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-frosted-glass/40">
                <th className="px-4 py-3 text-left font-medium text-dark-overlay">Metrik</th>
                <th className="px-4 py-3 text-right font-medium text-dark-overlay">
                  {data ? data.currentDate.split(" ")[0] : "Son Tarih"}
                </th>
                <th className="px-4 py-3 text-right font-medium text-dark-overlay">
                  {data ? data.previousDate : "Önceki Hafta"}
                </th>
                <th className="px-4 py-3 text-right font-medium text-dark-overlay">Değişim</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row) => (
                <tr key={row.metric} className="border-b border-frosted-glass/20 last:border-0">
                  <td className="px-4 py-3 font-medium text-charcoal-text">
                    {METRIC_LABELS[row.metric] ?? row.metric}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-charcoal-text">
                    {formatValue(row.metric, row.current)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-dark-overlay">
                    {formatValue(row.metric, row.previous)}
                  </td>
                  <ChangeCell change={row.change} metric={row.metric} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trends */}
      <div>
        <h3 className="text-xs font-medium text-dark-overlay tracking-[0.08em] uppercase mb-3">
          Geçen Haftaya Kıyasla Önemli Eğilimler
        </h3>
        <div className="space-y-2">
          {trends.map((t) => (
            <div
              key={t.title}
              className="border-l-[3px] border-[#eb3131] pl-4 py-3 rounded-r-[26px] bg-[#eb3131]/5"
            >
              <div className="text-xs font-medium text-charcoal-text mb-1">• {t.title}</div>
              <div className="text-xs text-dark-overlay leading-relaxed">{t.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
