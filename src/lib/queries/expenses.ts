import { isDemoMode } from "@/lib/demo/mode";
import { getSupabaseClient } from "@/lib/supabase/client";
import { demoExpenses } from "@/lib/demo/data";
import { toLocalISODate } from "@/lib/date";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  effective_date: string; // YYYY-MM-DD
  recurring_status: boolean;
};

const demoKey = (storeId: string) => `nph_demo_expenses:${storeId}`;

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function toIsoDate(d: Date) {
  return toLocalISODate(d);
}

function loadDemoExtra(storeId: string): ExpenseRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(demoKey(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ExpenseRow[];
  } catch {
    return [];
  }
}

function saveDemoExtra(storeId: string, rows: ExpenseRow[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(demoKey(storeId), JSON.stringify(rows));
  } catch {
    // ignore
  }
}

export async function fetchExpenses(params: {
  storeId: string;
  from: Date;
  to: Date; // exclusive
}): Promise<ExpenseRow[]> {
  const { storeId, from, to } = params;
  const fromDate = toIsoDate(from);
  const toInclusive = new Date(to);
  toInclusive.setDate(toInclusive.getDate() - 1);
  const toDate = toIsoDate(toInclusive);

  if (isDemoMode()) {
    const base = demoExpenses
      .filter((e) => e.store_id === storeId)
      .filter((e) => {
        const recurring = Boolean(e.recurring_status ?? false);
        if (recurring) return String(e.effective_date) <= toDate;
        return String(e.effective_date) >= fromDate && String(e.effective_date) <= toDate;
      })
      .map((e) => ({
        id: e.id,
        category: e.category,
        amount: e.amount,
        effective_date: e.effective_date,
        recurring_status: Boolean(e.recurring_status ?? false),
      }));
    const extra = loadDemoExtra(storeId).filter((e) => {
      const recurring = Boolean(e.recurring_status ?? false);
      if (recurring) return String(e.effective_date) <= toDate;
      return String(e.effective_date) >= fromDate && String(e.effective_date) <= toDate;
    });
    return [...base, ...extra].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  }

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
  effective_date: string; // YYYY-MM-DD
  recurring_status: boolean;
}) {
  if (isDemoMode()) {
    const next: ExpenseRow = {
      id: `demo-exp-${Date.now()}`,
      category: params.category,
      amount: params.amount,
      effective_date: params.effective_date,
      recurring_status: params.recurring_status,
    };
    const existing = loadDemoExtra(params.storeId);
    existing.unshift(next);
    saveDemoExtra(params.storeId, existing);
    return next;
  }

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
  if (isDemoMode()) {
    const existing = loadDemoExtra(params.storeId);
    const next = existing.filter((x) => x.id !== params.id);
    saveDemoExtra(params.storeId, next);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("expenses").delete().eq("id", params.id);
  if (error) throw error;
}
