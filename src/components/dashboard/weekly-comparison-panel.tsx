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
  if (metric === "Conversion Rate") return `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
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
  if (change == null) return <td className="px-3 py-3 text-right text-slate-400">—</td>;
  const isNegativeGood = metric === "Cost";
  const positive = isNegativeGood ? change <= 0 : change >= 0;
  const pct = `${change >= 0 ? "+" : ""}${(change * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
  return (
    <td className="px-3 py-3 text-right">
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
        {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {pct}
      </span>
    </td>
  );
}

const TRENDS = [
  {
    title: "Verimsiz Trafik Artışı",
    body: "Kullanıcı ve oturum sayılarında artış olmasına rağmen, bu trafik satışa etkin bir şekilde dönüşmemiştir. Bu durum, gelen trafiğin kalitesini veya site içi deneyimin sorgulanması gerektiğini gösterir.",
  },
  {
    title: "Dönüşüm Oranında Kritik Düşüş",
    body: "Dönüşüm oranı azalarak gerilemiştir. Bu, artan trafiğe rağmen işlem sayısının düşmesinin ana nedenidir.",
  },
  {
    title: "Maliyet Optimizasyonu ve Sınırlı ROAS Artışı",
    body: "Pazarlama maliyetleri azalmış olabilir, ancak verimlilik artışı gelirdeki düşüşü telafi etmek için yetersiz kalmaktadır.",
  },
];

function buildTrends(rows: WeeklyComparisonRow[]) {
  const txRow = rows.find((r) => r.metric === "Transactions");
  const revenueRow = rows.find((r) => r.metric === "Revenue");
  const costRow = rows.find((r) => r.metric === "Cost");
  const items: typeof TRENDS = [];

  if (txRow?.change != null && txRow.change < -0.1) {
    items.push({
      title: "İşlem Sayısında Düşüş",
      body: `Sipariş sayısı geçen haftanın aynı gününe kıyasla ${Math.abs(Math.round(txRow.change * 100))}% azalmıştır. Kampanya hedeflemelerini ve ürün listelemelerini gözden geçirin.`,
    });
  }

  if (revenueRow?.change != null && revenueRow.change < -0.05) {
    items.push({
      title: "Ciro Düşüşü",
      body: `Ciro geçen haftanın aynı gününe göre ${Math.abs(Math.round(revenueRow.change * 100))}% gerilemiştir. Kazanan kampanyaları ölçekleyin ve yüksek marjlı ürünlere odaklanın.`,
    });
  }

  if (costRow?.change != null && costRow.change > 0.1) {
    items.push({
      title: "Maliyet Artışı",
      body: `Pazarlama harcaması ${Math.round(costRow.change * 100)}% artmıştır. ROI hedefine göre bütçe limitlerini uygulayın.`,
    });
  }

  return items.length > 0 ? items : TRENDS;
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
    <div className="flex flex-col gap-4 p-5 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/40 backdrop-blur h-full overflow-auto">
      {/* Intro */}
      {data ? (
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{data.currentDate}</span> tarihine ait
          performans verileri, geçen haftanın aynı günü{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">({data.previousDate})</span> ile
          karşılaştırılarak detaylı sunulmuştur.
        </p>
      ) : (
        <p className="text-xs text-slate-400">Yükleniyor…</p>
      )}

      {/* Comparison table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">Genel Performans Değerlendirmesi</h3>
        <div className="overflow-auto rounded-lg border border-slate-200/70 dark:border-slate-800/70">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800/70 bg-slate-50/80 dark:bg-slate-900/50">
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">Metrik</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                  {data ? data.currentDate.split(" ")[0] : "Son Tarih"}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                  {data ? data.previousDate : "Önceki Hafta"}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">Değişim</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, i) => (
                <tr
                  key={row.metric}
                  className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "" : "bg-slate-50/40 dark:bg-slate-900/20"}`}
                >
                  <td className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">
                    {METRIC_LABELS[row.metric] ?? row.metric}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-800 dark:text-slate-200">
                    {formatValue(row.metric, row.current)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
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
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          Geçen Haftaya Kıyasla Önemli Eğilimler
        </h3>
        <div className="space-y-2">
          {trends.map((t) => (
            <div
              key={t.title}
              className="border-l-4 border-rose-400 dark:border-rose-600 pl-3 py-2 rounded-r-lg bg-rose-50/60 dark:bg-rose-950/20"
            >
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-0.5">• {t.title}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
