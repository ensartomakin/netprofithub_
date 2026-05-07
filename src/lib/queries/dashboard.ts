import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type DashboardPoint = {
  date: string;
  revenue: number;
  adSpend: number;
  cogs: number;
  netProfit: number;
};

export type TopProductRow = {
  sku: string;
  name: string;
  units: number;
  revenue: number;
  profit: number;
  margin: number | null;
};

const isoDate = (d: Date) => toLocalISODate(d);

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function enumerateDates(from: Date, to: Date) {
  const days: string[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  for (let d = start; d < end; d = addDays(d, 1)) {
    days.push(isoDate(d));
  }
  return days;
}

export async function fetchDashboardTimeseries(params: {
  storeId: string;
  from: Date;
  to: Date;
  shippingCostPerOrder?: number;
  marketplaceFeeRate?: number;
}) {
  const { storeId, from, to } = params;
  const shippingCostPerOrder = Number(params.shippingCostPerOrder ?? 0);
  const marketplaceFeeRate = Number(params.marketplaceFeeRate ?? 0);
  const days = enumerateDates(from, to);

  const supabase = getSupabaseClient();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("amount,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (ordersError) throw ordersError;

  const { data: spends, error: spendError } = await supabase
    .from("marketing_spend")
    .select("spend,date")
    .eq("store_id", storeId)
    .gte("date", isoDate(from))
    .lte("date", isoDate(addDays(to, -1)));
  if (spendError) throw spendError;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("sku,quantity,returned_quantity,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (itemsError) throw itemsError;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("sku,cogs")
    .eq("store_id", storeId);
  if (productsError) throw productsError;

  const cogsBySku = new Map<string, number>();
  for (const p of products ?? []) cogsBySku.set(String(p.sku), Number(p.cogs ?? 0));

  const revenueByDay = new Map<string, number>();
  const txByDay = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.status !== "odendi") continue;
    const d = toLocalISODate(new Date(String(o.ordered_at)));
    revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + Number(o.amount ?? 0));
    txByDay.set(d, (txByDay.get(d) ?? 0) + 1);
  }

  const spendByDay = new Map<string, number>();
  for (const s of spends ?? []) {
    const d = String(s.date);
    spendByDay.set(d, (spendByDay.get(d) ?? 0) + Number(s.spend ?? 0));
  }

  const cogsByDay = new Map<string, number>();
  for (const it of items ?? []) {
    const d = toLocalISODate(new Date(String(it.ordered_at)));
    const cogs = Number(cogsBySku.get(String(it.sku)) ?? 0);
    const netUnits = Math.max(
      0,
      Number(it.quantity ?? 0) - Number(it.returned_quantity ?? 0)
    );
    cogsByDay.set(d, (cogsByDay.get(d) ?? 0) + netUnits * cogs);
  }

  return days.map((d) => {
    const revenue = revenueByDay.get(d) ?? 0;
    const adSpend = spendByDay.get(d) ?? 0;
    const cogs = cogsByDay.get(d) ?? 0;
    const tx = txByDay.get(d) ?? 0;
    const shipping = tx * shippingCostPerOrder;
    const fees = revenue * marketplaceFeeRate;
    const netProfit = revenue - (adSpend + cogs + shipping + fees);
    return { date: d, revenue, adSpend, cogs, netProfit };
  });
}

export async function fetchTopProducts(params: {
  storeId: string;
  from: Date;
  to: Date;
  limit?: number;
}) {
  const { storeId, from, to, limit = 8 } = params;
  const supabase = getSupabaseClient();

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("sku,name,quantity,unit_price,discount,returned_quantity,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (itemsError) throw itemsError;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("sku,name,cogs")
    .eq("store_id", storeId);
  if (productsError) throw productsError;

  const nameBySku = new Map<string, string>();
  const cogsBySku = new Map<string, number>();
  for (const p of products ?? []) {
    nameBySku.set(String(p.sku), String(p.name));
    cogsBySku.set(String(p.sku), Number(p.cogs ?? 0));
  }

  const map = new Map<string, { units: number; revenue: number; name: string }>();
  for (const it of items ?? []) {
    const sku = String(it.sku);
    const row = map.get(sku) ?? {
      units: 0,
      revenue: 0,
      name: String(it.name ?? nameBySku.get(sku) ?? sku),
    };
    const netUnits = Math.max(
      0,
      Number(it.quantity ?? 0) - Number(it.returned_quantity ?? 0)
    );
    row.units += netUnits;
    row.revenue +=
      Number(it.quantity ?? 0) * Number(it.unit_price ?? 0) -
      Number(it.discount ?? 0);
    map.set(sku, row);
  }

  return Array.from(map.entries())
    .map(([sku, v]) => {
      const cogs = Number(cogsBySku.get(sku) ?? 0);
      const profit = v.revenue - v.units * cogs;
      const margin = safeDivide(profit, v.revenue);
      return { sku, name: v.name, units: v.units, revenue: v.revenue, profit, margin } satisfies TopProductRow;
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

export async function fetchPlatformSpend(params: {
  storeId: string;
  from: Date;
  to: Date;
}) {
  const { storeId, from, to } = params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("marketing_spend")
    .select("platform,spend,date")
    .eq("store_id", storeId)
    .gte("date", isoDate(from))
    .lte("date", isoDate(addDays(to, -1)));
  if (error) throw error;

  const map = new Map<string, number>();
  for (const s of data ?? []) {
    const platform = String(s.platform ?? "bilinmiyor");
    map.set(platform, (map.get(platform) ?? 0) + Number(s.spend ?? 0));
  }
  return Array.from(map.entries())
    .map(([platform, spend]) => ({ platform, spend }))
    .sort((a, b) => b.spend - a.spend);
}

export type DailyMetricsRow = {
  date: string;
  revenue: number;
  transactions: number;
  aov: number | null;
  adSpend: number;
  cos: number | null;
  roi: number | null;
  platform: Record<string, number>;
};

export async function fetchDailyMetrics(params: {
  storeId: string;
  from: Date;
  to: Date;
}) {
  const { storeId, from, to } = params;
  const days = enumerateDates(from, to);

  const build = (
    orders: Array<{ amount: number; status: string; ordered_at: string }>,
    spends: Array<{ platform: string; spend: number; date: string }>
  ) => {
    const revenueByDay = new Map<string, { revenue: number; tx: number }>();
    for (const o of orders) {
      if (o.status !== "odendi") continue;
      const d = toLocalISODate(new Date(o.ordered_at));
      const prev = revenueByDay.get(d) ?? { revenue: 0, tx: 0 };
      prev.revenue += Number(o.amount ?? 0);
      prev.tx += 1;
      revenueByDay.set(d, prev);
    }

    const spendByDay = new Map<string, { total: number; platform: Record<string, number> }>();
    for (const s of spends) {
      const d = s.date;
      const prev = spendByDay.get(d) ?? { total: 0, platform: {} as Record<string, number> };
      prev.total += Number(s.spend ?? 0);
      const key = String(s.platform ?? "bilinmiyor");
      prev.platform[key] = (prev.platform[key] ?? 0) + Number(s.spend ?? 0);
      spendByDay.set(d, prev);
    }

    return days.map((d) => {
      const rev = revenueByDay.get(d) ?? { revenue: 0, tx: 0 };
      const spend = spendByDay.get(d) ?? { total: 0, platform: {} };
      const aov = safeDivide(rev.revenue, rev.tx);
      const cos = safeDivide(spend.total, rev.revenue);
      const roi = safeDivide(rev.revenue, spend.total);
      return {
        date: d,
        revenue: rev.revenue,
        transactions: rev.tx,
        aov,
        adSpend: spend.total,
        cos,
        roi,
        platform: spend.platform,
      } satisfies DailyMetricsRow;
    });
  };

  const supabase = getSupabaseClient();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("amount,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (ordersError) throw ordersError;

  const { data: spends, error: spendError } = await supabase
    .from("marketing_spend")
    .select("platform,spend,date")
    .eq("store_id", storeId)
    .gte("date", isoDate(from))
    .lte("date", isoDate(addDays(to, -1)));
  if (spendError) throw spendError;

  return build(
    (orders ?? []).map((o) => ({
      amount: Number(o.amount ?? 0),
      status: String(o.status),
      ordered_at: String(o.ordered_at),
    })),
    (spends ?? []).map((s) => ({
      platform: String(s.platform ?? "bilinmiyor"),
      spend: Number(s.spend ?? 0),
      date: String(s.date),
    }))
  );
}

export type HourlyPoint = {
  hour: string;
  today: number;
  yesterday: number;
};

export async function fetchTodayVsYesterdayTimeseries(params: {
  storeId: string;
}): Promise<{ points: HourlyPoint[]; todayTotal: number; yesterdayTotal: number; todayTx: number; yesterdayTx: number }> {
  const { storeId } = params;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const yesterdayEnd = todayStart;

  const supabase = getSupabaseClient();

  const { data: todayOrders, error: e1 } = await supabase
    .from("orders")
    .select("amount,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", todayStart.toISOString())
    .lt("ordered_at", todayEnd.toISOString());
  if (e1) throw e1;

  const { data: yesterdayOrders, error: e2 } = await supabase
    .from("orders")
    .select("amount,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", yesterdayStart.toISOString())
    .lt("ordered_at", yesterdayEnd.toISOString());
  if (e2) throw e2;

  const bucket = (orders: typeof todayOrders, baseDate: Date) => {
    const map = new Map<number, number>();
    for (const o of orders ?? []) {
      if (o.status !== "odendi") continue;
      const d = new Date(String(o.ordered_at));
      const h = d.getHours();
      map.set(h, (map.get(h) ?? 0) + Number(o.amount ?? 0));
    }
    return map;
  };

  const todayMap = bucket(todayOrders, todayStart);
  const yesterdayMap = bucket(yesterdayOrders, yesterdayStart);

  const points: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    today: todayMap.get(h) ?? 0,
    yesterday: yesterdayMap.get(h) ?? 0,
  }));

  const todayTotal = (todayOrders ?? []).filter((o) => o.status === "odendi").reduce((a, o) => a + Number(o.amount ?? 0), 0);
  const yesterdayTotal = (yesterdayOrders ?? []).filter((o) => o.status === "odendi").reduce((a, o) => a + Number(o.amount ?? 0), 0);
  const todayTx = (todayOrders ?? []).filter((o) => o.status === "odendi").length;
  const yesterdayTx = (yesterdayOrders ?? []).filter((o) => o.status === "odendi").length;

  return { points, todayTotal, yesterdayTotal, todayTx, yesterdayTx };
}

export type WeeklyComparisonRow = {
  metric: string;
  current: number | null;
  previous: number | null;
  change: number | null;
};

export type WeeklyComparisonResult = {
  currentDate: string;
  previousDate: string;
  rows: WeeklyComparisonRow[];
};

export async function fetchWeeklyComparison(params: {
  storeId: string;
}): Promise<WeeklyComparisonResult> {
  const { storeId } = params;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const prevWeekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekEnd = new Date(todayEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const supabase = getSupabaseClient();

  const fetchDayOrders = async (from: Date, to: Date) => {
    const { data, error } = await supabase
      .from("orders")
      .select("amount,status,ordered_at")
      .eq("store_id", storeId)
      .gte("ordered_at", from.toISOString())
      .lt("ordered_at", to.toISOString());
    if (error) throw error;
    return data ?? [];
  };

  const fetchDaySpend = async (date: string) => {
    const { data, error } = await supabase
      .from("marketing_spend")
      .select("spend")
      .eq("store_id", storeId)
      .eq("date", date);
    if (error) throw error;
    return (data ?? []).reduce((a, s) => a + Number(s.spend ?? 0), 0);
  };

  const [currentOrders, prevOrders, currentSpend, prevSpend] = await Promise.all([
    fetchDayOrders(todayStart, todayEnd),
    fetchDayOrders(prevWeekStart, prevWeekEnd),
    fetchDaySpend(isoDate(todayStart)),
    fetchDaySpend(isoDate(prevWeekStart)),
  ]);

  const summarize = (orders: Awaited<ReturnType<typeof fetchDayOrders>>) => {
    const paid = orders.filter((o) => o.status === "odendi");
    const revenue = paid.reduce((a, o) => a + Number(o.amount ?? 0), 0);
    const transactions = paid.length;
    return { revenue, transactions };
  };

  const cur = summarize(currentOrders);
  const prev = summarize(prevOrders);

  const pct = (a: number | null, b: number | null) => {
    if (a == null || b == null || b === 0) return null;
    return (a - b) / b;
  };

  const rows: WeeklyComparisonRow[] = [
    { metric: "Transactions", current: cur.transactions, previous: prev.transactions, change: pct(cur.transactions, prev.transactions) },
    { metric: "Revenue", current: cur.revenue, previous: prev.revenue, change: pct(cur.revenue, prev.revenue) },
    { metric: "Cost", current: currentSpend, previous: prevSpend, change: pct(currentSpend, prevSpend) },
  ];

  const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  return {
    currentDate: `${fmt(todayStart)} (${dayNames[todayStart.getDay()]})`,
    previousDate: fmt(prevWeekStart),
    rows,
  };
}

export type MonthTargets = {
  revenueTarget: number;
  roiTarget: number;
};

export type MonthSummary = {
  monthLabel: string;
  revenueToDate: number;
  revenueLastMonthToDate: number;
  adSpendToDate: number;
  roiToDate: number | null;
  daysElapsed: number;
  daysInMonth: number;
  projectedMonthEndRevenue: number;
  paceDeviation: number | null;
  target: MonthTargets;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export async function fetchMonthSummary(params: { storeId: string; target: MonthTargets }) {
  const { storeId, target } = params;
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const startOfThisMonthCopy = new Date(today.getFullYear(), today.getMonth(), 1);
  const dayIndex = today.getDate();
  const lastMonthToDateEnd = new Date(startOfLastMonth);
  lastMonthToDateEnd.setDate(clamp(dayIndex, 1, new Date(today.getFullYear(), today.getMonth(), 0).getDate()) + 1);

  const supabase = getSupabaseClient();

  const sumRevenue = async (fromD: Date, toD: Date) => {
    const { data, error } = await supabase
      .from("orders")
      .select("amount,status,ordered_at")
      .eq("store_id", storeId)
      .gte("ordered_at", fromD.toISOString())
      .lt("ordered_at", toD.toISOString());
    if (error) throw error;
    return (data ?? [])
      .filter((o) => o.status === "odendi")
      .reduce((acc, o) => acc + Number(o.amount ?? 0), 0);
  };

  const revenueToDate = await sumRevenue(startOfMonth, new Date());
  const revenueLastMonthToDate = await sumRevenue(startOfLastMonth, lastMonthToDateEnd);

  const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - startOfThisMonthCopy.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const daysInMonth = Math.floor((startNextMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
  const dailyAvg = revenueToDate / daysElapsed;
  const projectedMonthEndRevenue = dailyAvg * daysInMonth;

  const fromDate = isoDate(startOfMonth);
  const toDate = isoDate(new Date());
  const { data: spendData, error: spendError } = await supabase
    .from("marketing_spend")
    .select("spend,date")
    .eq("store_id", storeId)
    .gte("date", fromDate)
    .lte("date", toDate);
  if (spendError) throw spendError;
  const adSpendToDate = (spendData ?? []).reduce((acc, s) => acc + Number(s.spend ?? 0), 0);
  const roiToDate = adSpendToDate > 0 ? revenueToDate / adSpendToDate : null;

  const targetToDate = target.revenueTarget * (daysElapsed / Math.max(1, daysInMonth));
  const paceDeviation =
    targetToDate > 0 ? (revenueToDate - targetToDate) / targetToDate : null;

  return {
    monthLabel: isoDate(startOfMonth).slice(0, 7),
    revenueToDate,
    revenueLastMonthToDate,
    adSpendToDate,
    roiToDate,
    daysElapsed,
    daysInMonth,
    projectedMonthEndRevenue,
    paceDeviation,
    target,
  } satisfies MonthSummary;
}
