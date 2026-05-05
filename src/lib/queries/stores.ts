import { getSupabaseClient } from "@/lib/supabase/client";

export type StoreRow = {
  id: string;
  name: string;
  platform: string;
  api_keys?: Record<string, unknown> | null;
};

export async function fetchStores(): Promise<StoreRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,platform,api_keys")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StoreRow[];
}

export async function createDefaultStore(): Promise<StoreRow> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Kullanıcı bulunamadı.");

  const { data, error } = await supabase
    .from("stores")
    .insert({
      owner_id: userData.user.id,
      name: "Ana Mağaza",
      platform: "manual",
      api_keys: {},
    })
    .select("id,name,platform,api_keys")
    .single();

  if (error) throw error;
  return data as StoreRow;
}
