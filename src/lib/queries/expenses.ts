import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  effective_date: string;
  recurring_status: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function toIsoDate(d: Date) {
  return toLocalISODate(d);
}

export async function fetchExpenses(params: {
  storeId: string;
  from: Date;
  to: Date;
}): Promise<ExpenseRow[]> {
  const { storeId, from, to } = params;
  const fromDate = toIsoDate(from);
  const toInclusive = new Date(to);
  toInclusive.setDate(toInclusive.getDate() - 1);
  const toDate = toIsoDate(toInclusive);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id,category,amount,effective_date,recurring_status")
    .eq("store_id", storeId)
    .lte("effective_date", toDate)
    .order("effective_date", { ascending: false });
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const r = asRecord(row);
      return {
        id: String(r.id ?? ""),
        category: String(r.category ?? ""),
        amount: Number(r.amount ?? 0),
        effective_date: String(r.effective_date ?? ""),
        recurring_status: Boolean(r.recurring_status ?? false),
      } satisfies ExpenseRow;
    })
    .filter((row) => {
      if (row.recurring_status) return true;
      return row.effective_date >= fromDate && row.effective_date <= toDate;
    });
}

export async function createExpense(params: {
  storeId: string;
  category: string;
  amount: number;
  effective_date: string;
  recurring_status: boolean;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      store_id: params.storeId,
      category: params.category,
      amount: params.amount,
      effective_date: params.effective_date,
      recurring_status: params.recurring_status,
    })
    .select("id,category,amount,effective_date,recurring_status")
    .single();
  if (error) throw error;
  return data as ExpenseRow;
}

export async function deleteExpense(params: { storeId: string; id: string }) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("expenses").delete().eq("id", params.id);
  if (error) throw error;
}
