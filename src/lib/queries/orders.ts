import { isDemoMode } from "@/lib/demo/mode";
import { getSupabaseClient } from "@/lib/supabase/client";
import { demoOrders } from "@/lib/demo/data";
import { loadRealOrders } from "@/lib/demo/real-store";

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
  if (isDemoMode()) {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const realOrders = loadRealOrders(storeId);
    if (realOrders.length > 0) {
      return realOrders
        .filter((o) => o.ordered_at >= fromIso && o.ordered_at < toIso)
        .map((o, i) => ({
          id: `real-order-${o.external_order_id}-${i}`,
          customer_id: o.customer_id,
          channel: null,
          amount: o.amount,
          tax: o.tax,
          shipping: o.shipping,
          status: o.status,
          ordered_at: o.ordered_at,
        })) as OrderRow[];
    }

    return demoOrders
      .filter((o) => o.store_id === storeId)
      .filter((o) => o.ordered_at >= fromIso && o.ordered_at < toIso)
      .map((o) => ({
        id: o.id,
        customer_id: o.customer_id ?? null,
        channel: o.channel ?? null,
        amount: o.amount,
        tax: o.tax,
        shipping: o.shipping,
        status: o.status,
        ordered_at: o.ordered_at,
      })) as OrderRow[];
  }

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
