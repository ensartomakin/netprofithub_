import { getSupabaseClient } from "@/lib/supabase/client";

export async function updateProductCogs(params: { id: string; cogs: number }) {
  const supabase = getSupabaseClient();
  const { id, cogs } = params;
  const { error } = await supabase.from("products").update({ cogs }).eq("id", id);
  if (error) throw error;
}

export async function updateProductDnr(params: { id: string; dnr: boolean }) {
  const supabase = getSupabaseClient();
  const { id, dnr } = params;
  const { error } = await supabase.from("products").update({ dnr }).eq("id", id);
  if (error) throw error;
}

export async function updateProductStatus(params: { id: string; status: string }) {
  const supabase = getSupabaseClient();
  const { id, status } = params;
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) throw error;
}
