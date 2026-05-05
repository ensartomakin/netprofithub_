import { getSupabaseClient } from "@/lib/supabase/client";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  cogs: number;
  stock_level: number;
  velocity: number;
  status: string;
  dnr: boolean;
};

export async function fetchProducts(params: { storeId: string }) {
  const supabase = getSupabaseClient();
  const { storeId } = params;
  const { data, error } = await supabase
    .from("products")
    .select("id,sku,name,stock_level,velocity,status,dnr,cogs")
    .eq("store_id", storeId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProductRow[];
}
