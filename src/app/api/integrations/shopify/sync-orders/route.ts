import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchAllShopifyOrders,
  normalizeShopifyOrders,
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

  const results: Array<{
    storeId: string;
    syncedOrders: number;
    syncedItems: number;
    error?: string;
  }> = [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getCreds(store.api_keys);
      if (!creds) {
        results.push({
          storeId: store.id,
          syncedOrders: 0,
          syncedItems: 0,
          error: "Missing api_keys",
        });
        continue;
      }

      const rawOrders = await fetchAllShopifyOrders(creds);
      const normalized = normalizeShopifyOrders(rawOrders);

      if (normalized.orders.length === 0) {
        results.push({ storeId: store.id, syncedOrders: 0, syncedItems: 0 });
        continue;
      }

      const { error: ordersUpsertError } = await admin.from("orders").upsert(
        normalized.orders.map((o) => ({
          store_id: store.id,
          external_order_id: o.external_order_id,
          amount: o.amount,
          tax: o.tax,
          shipping: o.shipping,
          status: o.status,
          customer_id: o.customer_id,
          ordered_at: o.ordered_at,
        })),
        { onConflict: "store_id,external_order_id" }
      );
      if (ordersUpsertError) throw ordersUpsertError;

      const externalIds = normalized.orders.map((o) => o.external_order_id);
      const { data: orderRows, error: orderFetchError } = await admin
        .from("orders")
        .select("id,external_order_id")
        .eq("store_id", store.id)
        .in("external_order_id", externalIds);
      if (orderFetchError) throw orderFetchError;

      const orderIdByExternal = new Map<number, string>();
      for (const r of orderRows ?? []) {
        orderIdByExternal.set(Number(r.external_order_id), String(r.id));
      }

      const itemsPayload = normalized.items.map((it) => ({
        store_id: store.id,
        order_id: orderIdByExternal.get(it.external_order_id) ?? null,
        external_line_item_id: it.external_line_item_id,
        sku: it.sku,
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        returned_quantity: it.returned_quantity,
        ordered_at: it.ordered_at,
      }));

      if (itemsPayload.length > 0) {
        const { error: itemsUpsertError } = await admin.from("order_items").upsert(
          itemsPayload,
          { onConflict: "store_id,external_line_item_id" }
        );
        if (itemsUpsertError) throw itemsUpsertError;
      }

      results.push({
        storeId: store.id,
        syncedOrders: normalized.orders.length,
        syncedItems: itemsPayload.length,
      });
    } catch (e) {
      results.push({
        storeId: store.id,
        syncedOrders: 0,
        syncedItems: 0,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

