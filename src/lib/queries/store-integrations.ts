import { getSupabaseClient } from "@/lib/supabase/client";

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

export async function connectShopify(params: {
  storeId: string;
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
}) {
  const supabase = getSupabaseClient();
  const { storeId, shopDomain, accessToken, apiVersion } = params;

  const patch = {
    shop_domain: shopDomain,
    access_token: accessToken,
    api_version: apiVersion ?? "2024-10",
  };

  const { data: current, error: currentError } = await supabase
    .from("stores")
    .select("api_keys")
    .eq("id", storeId)
    .single();
  if (currentError) throw currentError;

  const api_keys = { ...asRecord(asRecord(current).api_keys), ...patch };

  const { error } = await supabase
    .from("stores")
    .update({ platform: "shopify", api_keys })
    .eq("id", storeId);

  if (error) throw error;
}
