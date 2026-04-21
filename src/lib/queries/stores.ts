import { getSupabaseClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/mode";
import { demoStores } from "@/lib/demo/data";

export type StoreRow = {
  id: string;
  name: string;
  platform: string;
  api_keys?: Record<string, unknown> | null;
};

export async function fetchStores(): Promise<StoreRow[]> {
  if (isDemoMode()) {
    return demoStores.map((s) => ({
      id: s.id,
      name: s.name,
      platform: s.platform,
      api_keys: (s.api_keys ?? {}) as Record<string, unknown>,
    }));
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,platform,api_keys")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as StoreRow[];
}

export async function createDefaultStore(): Promise<StoreRow> {
  if (isDemoMode()) {
    const next: StoreRow = {
      id: `demo-store-${demoStores.length + 1}`,
      name: "Ana Mağaza",
      platform: "manual",
      api_keys: {},
    };
    demoStores.push(next);
    return next;
  }
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
