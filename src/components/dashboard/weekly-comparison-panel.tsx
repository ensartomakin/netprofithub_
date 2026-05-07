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
    return <td className="px-4 py-3 text-right text-graphite text-xs">—</td>;
  const isNegativeGood = metric === "Cost";
  const positive = isNegativeGood ? change <= 0 : change >= 0;
  const pct = `${change >= 0 ? "+" : ""}${(change * 100).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })}%`;
  return (
    <td className="px-4 py-3 text-right">
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-[8px] ${
          positive
            ? "bg-[#1dc479]/10 text-[#1dc479]"
            : "bg-[#eb3131]/10 text-[#eb3131]"
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
    body: "Kullanıcı ve oturum sayılarında artış olmasına rağmen bu trafik satışa etkin şekilde dönüşmemiştir. Gelen trafiğin kalitesi veya site içi deneyim sorgulanmalıdır.",
  },
  {
    title: "Dönüşüm Oranında Kritik Düşüş",
    body: "Dönüşüm oranı gerilemiştir. Bu, artan trafiğe rağmen işlem sayısının düşmesinin ana nedenidir.",
  },
  {
    title: "Maliyet Optimizasyonu ve Sınırlı ROAS Artışı",
    body: "Pazarlama maliyetleri azalmış olabilir; ancak verimlilik artışı gelirdeki düşüşü telafi etmek için yetersiz kalmaktadır.",
  },
];

function buildTrends(rows: WeeklyComparisonRow[]) {
  const txRow = rows.find((r) => r.metric === "Transactions");
  const revenueRow = rows.find((r) => r.metric === "Revenue");
  const costRow = rows.find((r) => r.metric === "Cost");
  const items: typeof STATIC_TRENDS = [];

  if (txRow?.change != null && txRow.change < -0.1) {
    items.push({
      title: "İşlem Sayısında Düşüş",
      body: `Sipariş sayısı geçen haftanın aynı gününe kıyasla ${Math.abs(
        Math.round(txRow.change * 100)
      )}% azalmıştır. Kampanya hedeflemelerini ve ürün listelemelerini gözden geçirin.`,
    });
  }
  if (revenueRow?.change != null && revenueRow.change < -0.05) {
    items.push({
      title: "Ciro Düşüşü",
      body: `Ciro geçen haftanın aynı gününe göre ${Math.abs(
        Math.round(revenueRow.change * 100)
      )}% gerilemiştir. Kazanan kampanyaları ölçekleyin ve yüksek marjlı ürünlere odaklanın.`,
    });
  }
  if (costRow?.change != null && costRow.change > 0.1) {
    items.push({
      title: "Maliyet Artışı",
      body: `Pazarlama harcaması ${Math.round(
        costRow.change * 100
      )}% artmıştır. ROI hedefine göre bütçe limitlerini uygulayın.`,
    });
  }
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
    ...(rows.find((r) => r.metric === "Cost")
      ? [rows.find((r) => r.metric === "Cost")!]
      : [{ metric: "Cost", current: null, previous: null, change: null }]),
    { metric: "Conversion Rate", current: null, previous: null, change: null },
    ...(rows.find((r) => r.metric === "Transactions")
      ? [rows.find((r) => r.metric === "Transactions")!]
      : [{ metric: "Transactions", current: null, previous: null, change: null }]),
    ...(rows.find((r) => r.metric === "Revenue")
      ? [rows.find((r) => r.metric === "Revenue")!]
      : [{ metric: "Revenue", current: null, previous: null, change: null }]),
  ];

  return (
    <div className="flex flex-col gap-5 p-6 rounded-[26px] border border-stone bg-white h-full overflow-auto">
      {/* Intro */}
      {data ? (
        <p className="text-xs text-graphite leading-relaxed">
          <span className="font-medium text-near-black">{data.currentDate}</span>{" "}
          tarihine ait performans verileri, geçen haftanın aynı günü{" "}
          <span className="font-medium text-near-black">({data.previousDate})</span>{" "}
          ile karşılaştırılarak detaylı sunulmuştur.
        </p>
      ) : (
        <p className="text-xs text-graphite">Yükleniyor…</p>
      )}

      {/* Comparison table */}
      <div>
        <h3 className="text-sm font-medium text-near-black mb-3">
          Genel Performans Değerlendirmesi
        </h3>
        <div className="overflow-auto rounded-[26px] border border-stone">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone bg-parchment-card">
                <th className="px-4 py-3 text-left font-medium text-graphite">
                  Metrik
                </th>
                <th className="px-4 py-3 text-right font-medium text-graphite">
                  {data ? data.currentDate.split(" ")[0] : "Son Tarih"}
                </th>
                <th className="px-4 py-3 text-right font-medium text-graphite">
                  {data ? data.previousDate : "Önceki Hafta"}
                </th>
                <th className="px-4 py-3 text-right font-medium text-graphite">
                  Değişim
                </th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, i) => (
                <tr
                  key={row.metric}
                  className={`border-b border-stone/40 last:border-0 ${
                    i % 2 === 1 ? "bg-parchment-card/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-near-black">
                    {METRIC_LABELS[row.metric] ?? row.metric}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-near-black">
                    {formatValue(row.metric, row.current)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-graphite">
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
        <h3 className="text-sm font-medium text-near-black mb-3">
          Geçen Haftaya Kıyasla Önemli Eğilimler
        </h3>
        <div className="space-y-2">
          {trends.map((t) => (
            <div
              key={t.title}
              className="border-l-[3px] border-coral-alert pl-4 py-3 rounded-r-[26px] bg-[#eb3131]/5"
            >
              <div className="text-xs font-medium text-near-black mb-1">
                • {t.title}
              </div>
              <div className="text-xs text-graphite leading-relaxed">{t.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
