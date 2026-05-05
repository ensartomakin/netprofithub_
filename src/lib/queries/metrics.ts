import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";
import { calculateExpenseTotalsForRange } from "@/lib/expenses/calc";
import { loadExpenseRules } from "@/lib/expense-rules";

export type DashboardSummary = {
  grossSales: number;
  shipping: number;
  tax: number;
  returns: number;
  adSpend: number;
  expensesTotal: number;
  cogsTotal: number;
  platformSpend: Record<string, number>;
};

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function toIsoDate(d: Date) {
  return toLocalISODate(d);
}

export async function fetchDashboardSummary(params: {
  storeId: string;
  from: Date;
  to: Date;
}): Promise<DashboardSummary> {
  const supabase = getSupabaseClient();
  const { storeId, from, to } = params;

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("amount,shipping,tax,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (ordersError) throw ordersError;

  const paid = (orders ?? []).filter((o) => o.status === "odendi");
  const refunded = (orders ?? []).filter((o) => o.status === "iade");

  const grossSales = sum(paid.map((o) => Number(o.amount ?? 0)));
  const shipping = sum(paid.map((o) => Number(o.shipping ?? 0)));
  const tax = sum(paid.map((o) => Number(o.tax ?? 0)));
  const returns = sum(refunded.map((o) => Number(o.amount ?? 0)));

  const fromDate = toIsoDate(from);
  const toInclusive = new Date(to);
  toInclusive.setDate(toInclusive.getDate() - 1);
  const toDate = toIsoDate(toInclusive);

  const { data: spends, error: spendError } = await supabase
    .from("marketing_spend")
    .select("platform,spend,date")
    .eq("store_id", storeId)
    .gte("date", fromDate)
    .lte("date", toDate);
  if (spendError) throw spendError;

  const platformSpend: Record<string, number> = {};
  for (const s of spends ?? []) {
    const key = String(s.platform ?? "bilinmiyor");
    platformSpend[key] = (platformSpend[key] ?? 0) + Number(s.spend ?? 0);
  }
  const adSpend = sum(Object.values(platformSpend));

  const { data: expenses, error: expenseError } = await supabase
    .from("expenses")
    .select("amount,effective_date,category,recurring_status")
    .eq("store_id", storeId)
    .lte("effective_date", toDate);
  if (expenseError) throw expenseError;

  const rules = loadExpenseRules(storeId);
  const expensesTotal = calculateExpenseTotalsForRange({
    expenses: (expenses ?? []).map((e) => {
      const r = asRecord(e);
      return {
        category: String(r.category ?? "Diğer"),
        amount: Number(r.amount ?? 0),
        effective_date: String(r.effective_date ?? ""),
        recurring_status: Boolean(r.recurring_status ?? false),
      };
    }),
    rules,
    grossSales,
    from,
    toExclusive: to,
  }).total;

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
  for (const p of products ?? []) {
    cogsBySku.set(String(p.sku), Number(p.cogs ?? 0));
  }

  const cogsTotal = sum(
    (items ?? []).map((it) => {
      const cogs = Number(cogsBySku.get(String(it.sku)) ?? 0);
      const netUnits = Math.max(
        0,
        Number(it.quantity ?? 0) - Number(it.returned_quantity ?? 0)
      );
      return netUnits * cogs;
    })
  );

  return { grossSales, shipping, tax, returns, adSpend, expensesTotal, cogsTotal, platformSpend };
}
