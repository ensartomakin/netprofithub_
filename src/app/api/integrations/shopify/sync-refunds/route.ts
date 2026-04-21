import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/demo/mode";
import {
  aggregateRefundedQuantities,
  fetchAllShopifyOrders,
  fetchShopifyRefundsForOrder,
  type ShopifyCredentials,
} from "@/lib/integrations/shopify";

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
  const apiVersion =
    typeof any.api_version === "string" ? any.api_version : undefined;

  if (!shopDomain || !accessToken) return null;
  return { shopDomain, accessToken, apiVersion };
}

export async function GET(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({
      ok: true,
      results: [{ storeId: "demo-store-1", updatedItems: 6, demo: true }],
    });
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

  const results: Array<{ storeId: string; updatedItems: number; error?: string }> =
    [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getCreds(store.api_keys);
      if (!creds) {
        results.push({ storeId: store.id, updatedItems: 0, error: "Missing api_keys" });
        continue;
      }

      const rawOrders = await fetchAllShopifyOrders(creds);
      let updatedItems = 0;

      for (const o of rawOrders) {
        const refunds = await fetchShopifyRefundsForOrder(creds, o.id);
        const refundedQtyByLineItem = aggregateRefundedQuantities(refunds);
        for (const [externalLineItemId, returned_quantity] of refundedQtyByLineItem) {
          const { error: updErr } = await admin
            .from("order_items")
            .update({ returned_quantity })
            .eq("store_id", store.id)
            .eq("external_line_item_id", externalLineItemId);
          if (!updErr) updatedItems += 1;
        }
      }

      results.push({ storeId: store.id, updatedItems });
    } catch (e) {
      results.push({
        storeId: store.id,
        updatedItems: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

