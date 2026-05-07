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
  return new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 0 }).format(v);
}

function formatPct(v: number) {
  return `%${Math.abs(Math.round(v * 100)).toLocaleString("tr-TR")}`;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null) return null;
  const positive = change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {formatPct(change)}
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

function StatTile({ icon, label, value, change, linkLabel }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 p-4 border border-slate-200/70 dark:border-slate-800/70 rounded-xl bg-white/40 dark:bg-slate-950/20">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{value}</div>
      <div className="flex items-center gap-3">
        <ChangeBadge change={change} />
        {linkLabel && (
          <span className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:underline">
            {linkLabel} &rsaquo;
          </span>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 px-3 py-2 shadow-md text-xs">
      <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name === "today" ? "Bugün" : "Dün"}:</span>
          <span className="font-semibold">{formatTRY(p.value)}</span>
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
  const lastUpdated = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} - ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const todayTotal = data?.todayTotal ?? 0;
  const yesterdayTotal = data?.yesterdayTotal ?? 0;
  const todayTx = data?.todayTx ?? 0;
  const yesterdayTx = data?.yesterdayTx ?? 0;

  const todayChange = yesterdayTotal > 0 ? (todayTotal - yesterdayTotal) / yesterdayTotal : null;
  const txChange = yesterdayTx > 0 ? (todayTx - yesterdayTx) / yesterdayTx : null;

  const points = data?.points ?? Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    today: 0,
    yesterday: 0,
  }));

  const tickHours = ["00:00", "06:00", "12:00", "18:00", "23:00"];

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/40 backdrop-blur h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Genel Performansım</h2>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Son Güncelleme: {lastUpdated}</div>
        </div>
        <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-1.5 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors">
          <span className="text-base leading-none">📊</span>
          Canlı Performansım &rsaquo;
        </button>
      </div>

      {/* Revenue summary */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Bugünkü Net Cirom:</div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatTRY(todayTotal)}
            </span>
            <ChangeBadge change={todayChange} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Dünkü Net Cirom:</div>
            <div className="text-base font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {formatTRY(yesterdayTotal)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" /> Bugün</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Dün</span>
          </div>
        </div>
      </div>

      {/* Area Chart */}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradToday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fb923c" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradYesterday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "rgba(100,116,139,0.8)" }}
              ticks={tickHours}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(100,116,139,0.8)" }}
              tickFormatter={(v) => formatCompact(Number(v))}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="yesterday"
              stroke="#94a3b8"
              strokeWidth={1.5}
              fill="url(#gradYesterday)"
              dot={false}
              strokeDasharray="4 2"
            />
            <Area
              type="monotone"
              dataKey="today"
              stroke="#fb923c"
              strokeWidth={2}
              fill="url(#gradToday)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Users size={14} />}
          label="Toplam Görüntülenme"
          value="—"
          change={null}
          linkLabel="Raporu İncele"
        />
        <StatTile
          icon={<ClipboardList size={14} />}
          label="Net Sipariş Adedi"
          value={String(todayTx)}
          change={txChange}
          linkLabel="Siparişleri Gör"
        />
        <StatTile
          icon={<Package size={14} />}
          label="Net Satış Adedi"
          value={String(todayTx)}
          change={txChange}
          linkLabel="Raporu İncele"
        />
        <StatTile
          icon={<BarChart2 size={14} />}
          label="Satışa Dönüş Oranı"
          value="—"
          change={null}
        />
      </div>
    </div>
  );
}
