import { isDemoMode } from "@/lib/demo/mode";
import {
  demoOrderItems,
  demoOrders,
  demoProducts,
  demoSpends,
} from "@/lib/demo/data";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type DashboardPoint = {
  date: string; // YYYY-MM-DD
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
  to: Date; // exclusive
  shippingCostPerOrder?: number;
  marketplaceFeeRate?: number; // 0..1
}) {
  const { storeId, from, to } = params;
  const shippingCostPerOrder = Number(params.shippingCostPerOrder ?? 0);
  const marketplaceFeeRate = Number(params.marketplaceFeeRate ?? 0);
  const days = enumerateDates(from, to);

  if (isDemoMode()) {
    const cogsBySku = new Map(
      demoProducts
        .filter((p) => p.store_id === storeId)
        .map((p) => [p.sku, p.cogs] as const)
    );

    const revenueByDay = new Map<string, number>();
    const txByDay = new Map<string, number>();
    for (const o of demoOrders) {
      if (o.store_id !== storeId) continue;
      if (o.ordered_at < from.toISOString() || o.ordered_at >= to.toISOString())
        continue;
      if (o.status !== "odendi") continue;
      const d = toLocalISODate(new Date(o.ordered_at));
      revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + o.amount);
      txByDay.set(d, (txByDay.get(d) ?? 0) + 1);
    }

    const spendByDay = new Map<string, number>();
    for (const s of demoSpends) {
      if (s.store_id !== storeId) continue;
      if (s.date < isoDate(from) || s.date >= isoDate(to)) continue;
      spendByDay.set(s.date, (spendByDay.get(s.date) ?? 0) + s.spend);
    }

    const cogsByDay = new Map<string, number>();
    for (const it of demoOrderItems) {
      if (it.store_id !== storeId) continue;
      if (it.ordered_at < from.toISOString() || it.ordered_at >= to.toISOString())
        continue;
      const d = toLocalISODate(new Date(it.ordered_at));
      const cogs = Number(cogsBySku.get(it.sku) ?? 0);
      const netUnits = Math.max(0, it.quantity - (it.returned_quantity ?? 0));
      cogsByDay.set(d, (cogsByDay.get(d) ?? 0) + netUnits * cogs);
    }

    const points: DashboardPoint[] = days.map((d) => {
      const revenue = revenueByDay.get(d) ?? 0;
      const adSpend = spendByDay.get(d) ?? 0;
      const cogs = cogsByDay.get(d) ?? 0;
      const tx = txByDay.get(d) ?? 0;
      const shipping = tx * shippingCostPerOrder;
      const fees = revenue * marketplaceFeeRate;
      const netProfit = revenue - (adSpend + cogs + shipping + fees);
      return { date: d, revenue, adSpend, cogs, netProfit };
    });

    return points;
  }

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
  to: Date; // exclusive
  limit?: number;
}) {
  const { storeId, from, to, limit = 8 } = params;

  if (isDemoMode()) {
    const nameBySku = new Map(
      demoProducts
        .filter((p) => p.store_id === storeId)
        .map((p) => [p.sku, p.name] as const)
    );
    const cogsBySku = new Map(
      demoProducts
        .filter((p) => p.store_id === storeId)
        .map((p) => [p.sku, p.cogs] as const)
    );

    const map = new Map<string, { units: number; revenue: number }>();
    for (const it of demoOrderItems) {
      if (it.store_id !== storeId) continue;
      if (it.ordered_at < from.toISOString() || it.ordered_at >= to.toISOString())
        continue;
      const sku = it.sku;
      const row = map.get(sku) ?? { units: 0, revenue: 0 };
      const netUnits = Math.max(0, it.quantity - (it.returned_quantity ?? 0));
      row.units += netUnits;
      row.revenue += it.quantity * it.unit_price - it.discount;
      map.set(sku, row);
    }

    return Array.from(map.entries())
      .map(([sku, v]) => {
        const cogs = Number(cogsBySku.get(sku) ?? 0);
        const profit = v.revenue - v.units * cogs;
        const margin = safeDivide(profit, v.revenue);
        return {
          sku,
          name: nameBySku.get(sku) ?? sku,
          units: v.units,
          revenue: v.revenue,
          profit,
          margin,
        } satisfies TopProductRow;
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, limit);
  }

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
      return {
        sku,
        name: v.name,
        units: v.units,
        revenue: v.revenue,
        profit,
        margin,
      } satisfies TopProductRow;
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);
}

export async function fetchPlatformSpend(params: {
  storeId: string;
  from: Date;
  to: Date; // exclusive
}) {
  const { storeId, from, to } = params;

  if (isDemoMode()) {
    const fromDate = isoDate(from);
    const toInclusive = isoDate(addDays(to, -1));
    const map = new Map<string, number>();
    for (const s of demoSpends) {
      if (s.store_id !== storeId) continue;
      if (s.date < fromDate || s.date > toInclusive) continue;
      map.set(s.platform, (map.get(s.platform) ?? 0) + s.spend);
    }
    return Array.from(map.entries())
      .map(([platform, spend]) => ({ platform, spend }))
      .sort((a, b) => b.spend - a.spend);
  }

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
  date: string; // YYYY-MM-DD
  revenue: number;
  transactions: number;
  aov: number | null;
  adSpend: number;
  cos: number | null; // adSpend / revenue
  roi: number | null; // revenue / adSpend
  platform: Record<string, number>;
};

export async function fetchDailyMetrics(params: {
  storeId: string;
  from: Date;
  to: Date; // exclusive
}) {
  const { storeId, from, to } = params;
  const days = enumerateDates(from, to);

  const build = (orders: Array<{ amount: number; status: string; ordered_at: string }>, spends: Array<{ platform: string; spend: number; date: string }>) => {
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

  if (isDemoMode()) {
    const orders = demoOrders
      .filter((o) => o.store_id === storeId)
      .filter((o) => o.ordered_at >= from.toISOString() && o.ordered_at < to.toISOString());
    const spends = demoSpends
      .filter((s) => s.store_id === storeId)
      .filter((s) => s.date >= isoDate(from) && s.date <= isoDate(addDays(to, -1)));
    return build(orders, spends);
  }

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

export type MonthTargets = {
  revenueTarget: number;
  roiTarget: number;
};

export type MonthSummary = {
  monthLabel: string; // 2026-04
  revenueToDate: number;
  revenueLastMonthToDate: number;
  adSpendToDate: number;
  roiToDate: number | null;
  daysElapsed: number;
  daysInMonth: number;
  projectedMonthEndRevenue: number;
  paceDeviation: number | null; // vs hedefin bugüne kadarki payı
  target: MonthTargets;
};

export async function fetchMonthSummary(params: { storeId: string; target: MonthTargets }) {
  const { storeId, target } = params;
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const startOfThisMonthCopy = new Date(today.getFullYear(), today.getMonth(), 1);
  const dayIndex = today.getDate(); // 1-based
  const lastMonthToDateEnd = new Date(startOfLastMonth);
  lastMonthToDateEnd.setDate(clamp(dayIndex, 1, new Date(today.getFullYear(), today.getMonth(), 0).getDate()) + 1);

  const from = startOfMonth;
  const fromLast = startOfLastMonth;
  const toLastToDate = lastMonthToDateEnd;

  const sumRevenue = async (fromD: Date, toD: Date) => {
    if (isDemoMode()) {
      return demoOrders
        .filter((o) => o.store_id === storeId)
        .filter((o) => o.status === "odendi")
        .filter((o) => o.ordered_at >= fromD.toISOString() && o.ordered_at < toD.toISOString())
        .reduce((acc, o) => acc + o.amount, 0);
    }
    const supabase = getSupabaseClient();
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

  const revenueToDate = await sumRevenue(from, new Date());
  const revenueLastMonthToDate = await sumRevenue(fromLast, toLastToDate);

  const daysElapsed = Math.max(1, Math.floor((new Date().getTime() - startOfThisMonthCopy.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const daysInMonth = Math.floor((startNextMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
  const dailyAvg = revenueToDate / daysElapsed;
  const projectedMonthEndRevenue = dailyAvg * daysInMonth;

  const sumSpendToDate = async () => {
    const fromDate = isoDate(startOfMonth);
    const toDate = isoDate(new Date());
    if (isDemoMode()) {
      return demoSpends
        .filter((s) => s.store_id === storeId)
        .filter((s) => s.date >= fromDate && s.date <= toDate)
        .reduce((acc, s) => acc + s.spend, 0);
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("marketing_spend")
      .select("spend,date")
      .eq("store_id", storeId)
      .gte("date", fromDate)
      .lte("date", toDate);
    if (error) throw error;
    return (data ?? []).reduce((acc, s) => acc + Number(s.spend ?? 0), 0);
  };

  const adSpendToDate = await sumSpendToDate();
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
