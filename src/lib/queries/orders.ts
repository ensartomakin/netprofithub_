import { getSupabaseClient } from "@/lib/supabase/client";

export type OrderRow = {
  id: string;
  customer_id: string | null;
  channel: string | null;
  amount: number;
  tax: number;
  shipping: number;
  status: "odendi" | "iade" | "iptal" | "beklemede" | string;
  ordered_at: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

export async function fetchOrders(params: { storeId: string; from: Date; to: Date }) {
  const { storeId, from, to } = params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id,customer_id,amount,tax,shipping,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString())
    .order("ordered_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = asRecord(row);
    return {
      id: String(r.id ?? ""),
      customer_id: r.customer_id == null ? null : String(r.customer_id),
      channel: r.channel == null ? null : String(r.channel),
      amount: Number(r.amount ?? 0),
      tax: Number(r.tax ?? 0),
      shipping: Number(r.shipping ?? 0),
      status: String(r.status ?? ""),
      ordered_at: String(r.ordered_at ?? ""),
    } satisfies OrderRow;
  });
}
