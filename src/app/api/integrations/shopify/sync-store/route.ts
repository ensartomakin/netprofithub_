import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllShopifyProducts,
  normalizeShopifyProducts,
  type ShopifyCredentials,
} from "@/lib/integrations/shopify";
import { isDemoMode } from "@/lib/demo/mode";

function getCreds(apiKeys: unknown): ShopifyCredentials | null {
  if (!apiKeys || typeof apiKeys !== "object") return null;
  const any = apiKeys as Record<string, unknown>;
  const shopDomain = typeof any.shop_domain === "string" ? any.shop_domain : "";
  const accessToken =
    typeof any.access_token === "string" ? any.access_token : "";
  const apiVersion = typeof any.api_version === "string" ? any.api_version : undefined;

  if (!shopDomain || !accessToken) return null;
  return { shopDomain, accessToken, apiVersion };
}

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, synced: 3, demo: true });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeId } = (await req.json().catch(() => ({}))) as {
    storeId?: string;
  };
  if (!storeId) {
    return NextResponse.json({ error: "storeId required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { error: "Supabase env eksik" },
      { status: 500 }
    );
  }

  // RLS ile store ownership doğrulaması için user token ile client oluştur.
  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,platform,api_keys")
    .eq("id", storeId)
    .single();

  if (storeError) {
    return NextResponse.json({ error: storeError.message }, { status: 400 });
  }

  if (store.platform !== "shopify") {
    return NextResponse.json(
      { error: "Store platform shopify değil" },
      { status: 400 }
    );
  }

  const creds = getCreds(store.api_keys);
  if (!creds) {
    return NextResponse.json(
      { error: "Shopify api_keys eksik" },
      { status: 400 }
    );
  }

  const products = await fetchAllShopifyProducts(creds);
  const normalized = normalizeShopifyProducts(products);

  if (normalized.length === 0) {
    return NextResponse.json({ ok: true, synced: 0 });
  }

  const { error: upsertError } = await supabase.from("products").upsert(
    normalized.map((p) => ({
      store_id: store.id,
      sku: p.sku,
      name: p.name,
      stock_level: p.stock_level,
      status: p.status,
    })),
    { onConflict: "store_id,sku" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, synced: normalized.length });
}
