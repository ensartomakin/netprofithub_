import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchAllShopifyProducts,
  normalizeShopifyProducts,
  type ShopifyCredentials,
} from "@/lib/integrations/shopify";
import { isDemoMode } from "@/lib/demo/mode";

type StoreRow = {
  id: string;
  platform: string;
  api_keys: unknown;
};

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

export async function GET(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, results: [{ storeId: "demo-store-1", synced: 3, demo: true }] });
  }
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: stores, error } = await admin
    .from("stores")
    .select("id,platform,api_keys")
    .eq("platform", "shopify");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ storeId: string; synced: number; error?: string }> = [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getCreds(store.api_keys);
      if (!creds) {
        results.push({ storeId: store.id, synced: 0, error: "Missing api_keys" });
        continue;
      }

      const products = await fetchAllShopifyProducts(creds);
      const normalized = normalizeShopifyProducts(products);

      if (normalized.length === 0) {
        results.push({ storeId: store.id, synced: 0 });
        continue;
      }

      // Upsert by (store_id, sku)
      const { error: upsertError } = await admin.from("products").upsert(
        normalized.map((p) => ({
          store_id: store.id,
          sku: p.sku,
          name: p.name,
          stock_level: p.stock_level,
          status: p.status,
        })),
        { onConflict: "store_id,sku" }
      );

      if (upsertError) throw upsertError;

      results.push({ storeId: store.id, synced: normalized.length });
    } catch (e) {
      results.push({
        storeId: store.id,
        synced: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
