import { isDemoMode } from "@/lib/demo/mode";
import { getSupabaseClient } from "@/lib/supabase/client";
import { demoOrders } from "@/lib/demo/data";

export type CohortCell = {
  monthOffset: number; // 0..N
  activeCustomers: number;
  retentionPct: number | null; // active / cohortSize
  revenue: number;
  ltvPerCustomer: number | null; // cumulative revenue / cohortSize
};

export type CohortRow = {
  cohortMonth: string; // YYYY-MM
  cohortSize: number;
  cells: CohortCell[];
};

export type RepurchaseStats = {
  customers: number;
  repeat2Pct: number | null;
  repeat3Pct: number | null;
  repeat4Pct: number | null;
};

export type CustomerAnalyticsResult = {
  basis: { from: string; to: string; months: number };
  cohorts: CohortRow[];
  repurchase: RepurchaseStats;
};

type OrderRow = {
  amount: number;
  status: string;
  ordered_at: string;
  customer_id: string;
};

function monthKey(iso: string) {
  return String(iso).slice(0, 7); // YYYY-MM
}

function enumerateMonths(from: Date, toExclusive: Date) {
  const start = new Date(from);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toExclusive);
  end.setDate(1);
  end.setHours(0, 0, 0, 0);

  const out: string[] = [];
  for (let d = start; d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}

function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function buildRepurchase(orders: OrderRow[]) {
  const byCustomer = new Map<string, number>();
  for (const o of orders) {
    byCustomer.set(o.customer_id, (byCustomer.get(o.customer_id) ?? 0) + 1);
  }
  const counts = Array.from(byCustomer.values());
  const customers = counts.length;
  const repeat2 = counts.filter((c) => c >= 2).length;
  const repeat3 = counts.filter((c) => c >= 3).length;
  const repeat4 = counts.filter((c) => c >= 4).length;
  return {
    customers,
    repeat2Pct: safeDivide(repeat2, customers),
    repeat3Pct: safeDivide(repeat3, customers),
    repeat4Pct: safeDivide(repeat4, customers),
  } satisfies RepurchaseStats;
}

export async function fetchCustomerAnalytics(params: {
  storeId: string;
  from: Date;
  to: Date; // exclusive
  maxMonths?: number;
}): Promise<CustomerAnalyticsResult> {
  const { storeId, from, to, maxMonths = 6 } = params;

  let orders: OrderRow[] = [];
  if (isDemoMode()) {
    orders = demoOrders
      .filter((o) => o.store_id === storeId)
      .filter((o) => o.status === "odendi")
      .filter((o) => o.ordered_at >= from.toISOString() && o.ordered_at < to.toISOString())
      .map((o) => ({
        amount: Number(o.amount ?? 0),
        status: o.status,
        ordered_at: o.ordered_at,
        customer_id: o.customer_id,
      }));
  } else {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("orders")
      .select("amount,status,ordered_at,customer_id")
      .eq("store_id", storeId)
      .gte("ordered_at", from.toISOString())
      .lt("ordered_at", to.toISOString());
    if (error) throw error;

    orders = (data ?? [])
      .map((row) => row as unknown as Record<string, unknown>)
      .map((r) => ({
        amount: Number(r.amount ?? 0),
        status: String(r.status ?? ""),
        ordered_at: String(r.ordered_at ?? ""),
        customer_id: String(r.customer_id ?? ""),
      }))
      .filter((o) => o.status === "odendi" && o.customer_id.length > 0);
  }

  const months = enumerateMonths(from, to);
  const displayMonths = months.slice(Math.max(0, months.length - maxMonths));
  const monthIndex = new Map(displayMonths.map((m, idx) => [m, idx] as const));

  // First purchase month (MVP: only within selected range)
  const firstMonthByCustomer = new Map<string, string>();
  for (const o of orders) {
    const m = monthKey(o.ordered_at);
    if (!monthIndex.has(m)) continue;
    const prev = firstMonthByCustomer.get(o.customer_id);
    if (!prev || m < prev) firstMonthByCustomer.set(o.customer_id, m);
  }

  // Orders grouped by customer & month
  const revenueByCustomerMonth = new Map<string, Map<string, number>>();
  for (const o of orders) {
    const m = monthKey(o.ordered_at);
    if (!monthIndex.has(m)) continue;
    const cm =
      revenueByCustomerMonth.get(o.customer_id) ??
      (revenueByCustomerMonth.set(o.customer_id, new Map()), revenueByCustomerMonth.get(o.customer_id)!);
    cm.set(m, (cm.get(m) ?? 0) + o.amount);
  }

  const cohortCustomers = new Map<string, string[]>();
  for (const [cid, m] of firstMonthByCustomer.entries()) {
    const arr = cohortCustomers.get(m) ?? [];
    arr.push(cid);
    cohortCustomers.set(m, arr);
  }

  const cohorts: CohortRow[] = displayMonths
    .map((m) => {
      const customers = cohortCustomers.get(m) ?? [];
      const cohortSize = customers.length;
      const startIdx = monthIndex.get(m);
      const cells: CohortCell[] = [];
      if (startIdx == null) {
        return { cohortMonth: m, cohortSize, cells };
      }

      let cumulativeRevenue = 0;
      for (let offset = 0; offset < displayMonths.length - startIdx; offset += 1) {
        const targetMonth = displayMonths[startIdx + offset]!;
        let active = 0;
        let revenue = 0;
        for (const cid of customers) {
          const cm = revenueByCustomerMonth.get(cid);
          const r = cm?.get(targetMonth) ?? 0;
          if (r > 0) active += 1;
          revenue += r;
        }
        cumulativeRevenue += revenue;
        cells.push({
          monthOffset: offset,
          activeCustomers: active,
          retentionPct: safeDivide(active, cohortSize),
          revenue,
          ltvPerCustomer: safeDivide(cumulativeRevenue, cohortSize),
        });
      }
      return { cohortMonth: m, cohortSize, cells };
    })
    .filter((r) => r.cohortSize > 0);

  const repurchase = buildRepurchase(orders);

  return {
    basis: { from: from.toISOString(), to: to.toISOString(), months: displayMonths.length },
    cohorts,
    repurchase,
  };
}
