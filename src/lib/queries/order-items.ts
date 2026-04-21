import { getSupabaseClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/mode";
import { demoOrderItems } from "@/lib/demo/data";

export type OrderItemRow = {
  id: string;
  sku: string;
  name: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  returned_quantity: number;
  ordered_at: string;
};

export async function fetchOrderItems(params: {
  storeId: string;
  from: Date;
  to: Date; // exclusive
}) {
  if (isDemoMode()) {
    const fromIso = params.from.toISOString();
    const toIso = params.to.toISOString();
    return demoOrderItems
      .filter((x) => x.store_id === params.storeId)
      .filter((x) => x.ordered_at >= fromIso && x.ordered_at < toIso)
      .map((x) => ({
        id: x.id,
        sku: x.sku,
        name: x.name,
        quantity: x.quantity,
        unit_price: x.unit_price,
        discount: x.discount,
        returned_quantity: x.returned_quantity,
        ordered_at: x.ordered_at,
      }));
  }
  const supabase = getSupabaseClient();
  const { storeId, from, to } = params;

  const { data, error } = await supabase
    .from("order_items")
    .select("id,sku,name,quantity,unit_price,discount,returned_quantity,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());

  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}
