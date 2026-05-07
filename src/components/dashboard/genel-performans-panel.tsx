"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTodayVsYesterdayTimeseries } from "@/lib/queries/dashboard";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Users, ClipboardList, Package, BarChart2 } from "lucide-react";

function formatTRY(v: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(v);
}

function formatCompact(v: number) {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(v);
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null) return null;
  const positive = change >= 0;
  const pct = `%${Math.abs(Math.round(change * 100)).toLocaleString("tr-TR")}`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
        positive ? "bg-[#1dc479]/15 text-[#1dc479]" : "bg-[#eb3131]/10 text-[#eb3131]"
      }`}
    >
      {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct}
    </span>
  );
}

type StatTileProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number | null;
  linkLabel?: string;
};

/* Seed: warm-gray surface inside white card */
function StatTile({ icon, label, value, change, linkLabel }: StatTileProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-[16px] bg-warm-gray">
      <div className="flex items-center gap-1.5 text-dark-overlay">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-medium text-charcoal-text tabular-nums">{value}</div>
      <div className="flex items-center gap-3">
        <ChangeBadge change={change} />
        {linkLabel && (
          <span className="text-xs text-dark-overlay cursor-pointer hover:text-charcoal-text hover:underline underline-offset-2 transition-colors">
            {linkLabel} &rsaquo;
          </span>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[16px] bg-white px-4 py-3 text-xs border border-frosted-glass">
      <div className="font-medium text-charcoal-text mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-dark-overlay">{p.name === "today" ? "Bugün" : "Dün"}:</span>
          <span className="font-medium text-charcoal-text">{formatTRY(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function GenerelPerformansPanel({ storeId }: { storeId: string }) {
  const query = useQuery({
    queryKey: ["todayVsYesterday", storeId],
    queryFn: () => fetchTodayVsYesterdayTimeseries({ storeId }),
    enabled: Boolean(storeId),
    refetchInterval: 5 * 60 * 1000,
  });

  const data = query.data;
  const now = new Date();
  const lastUpdated = `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1
  ).padStart(2, "0")}/${now.getFullYear()} - ${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const todayTotal = data?.todayTotal ?? 0;
  const yesterdayTotal = data?.yesterdayTotal ?? 0;
  const todayTx = data?.todayTx ?? 0;
  const yesterdayTx = data?.yesterdayTx ?? 0;
  const todayChange = yesterdayTotal > 0 ? (todayTotal - yesterdayTotal) / yesterdayTotal : null;
  const txChange = yesterdayTx > 0 ? (todayTx - yesterdayTx) / yesterdayTx : null;

  const points =
    data?.points ??
    Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      today: 0,
      yesterday: 0,
    }));

  return (
    /* White card floating on snow-white page */
    <div className="flex flex-col gap-5 p-6 rounded-[16px] bg-white h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-charcoal-text">Genel Performansım</h2>
          <div className="text-xs text-dark-overlay mt-0.5">Son Güncelleme: {lastUpdated}</div>
        </div>
        <button className="inline-flex items-center gap-1.5 text-xs font-medium text-snow-white bg-forest-green rounded-full px-4 py-2 hover:opacity-90 transition-opacity shrink-0">
          <span className="text-sm leading-none">📊</span>
          Canlı Performansım &rsaquo;
        </button>
      </div>

      {/* Revenue summary */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-dark-overlay mb-1">Bugünkü Net Cirom:</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[28px] font-medium text-charcoal-text tabular-nums leading-none">
              {formatTRY(todayTotal)}
            </span>
            <ChangeBadge change={todayChange} />
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-xs text-dark-overlay mb-0.5">Dünkü Net Cirom:</div>
            <div className="text-base font-medium text-charcoal-text tabular-nums">
              {formatTRY(yesterdayTotal)}
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-dark-overlay">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-green inline-block" />
              Bugün
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-frosted-glass inline-block" />
              Dün
            </span>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gpToday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1c3a13" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1c3a13" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gpYesterday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c4c7c4" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#c4c7c4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,199,196,0.5)" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "#666666" }}
              ticks={["00:00", "06:00", "12:00", "18:00", "23:00"]}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#666666" }}
              tickFormatter={(v) => formatCompact(Number(v))}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="yesterday"
              stroke="#c4c7c4"
              strokeWidth={1.5}
              fill="url(#gpYesterday)"
              dot={false}
              strokeDasharray="4 2"
            />
            <Area
              type="monotone"
              dataKey="today"
              stroke="#1c3a13"
              strokeWidth={2}
              fill="url(#gpToday)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<Users size={13} />} label="Toplam Görüntülenme" value="—" change={null} linkLabel="Raporu İncele" />
        <StatTile icon={<ClipboardList size={13} />} label="Net Sipariş Adedi" value={String(todayTx)} change={txChange} linkLabel="Siparişleri Gör" />
        <StatTile icon={<Package size={13} />} label="Net Satış Adedi" value={String(todayTx)} change={txChange} linkLabel="Raporu İncele" />
        <StatTile icon={<BarChart2 size={13} />} label="Satışa Dönüş Oranı" value="—" change={null} />
      </div>
    </div>
  );
}
