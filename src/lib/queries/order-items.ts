import { getSupabaseClient } from "@/lib/supabase/client";

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
  to: Date;
}) {
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
