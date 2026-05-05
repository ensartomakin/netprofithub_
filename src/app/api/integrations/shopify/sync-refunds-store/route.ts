import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  aggregateRefundedQuantities,
  fetchAllShopifyOrders,
  fetchShopifyRefundsForOrder,
  type ShopifyCredentials,
} from "@/lib/integrations/shopify";

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

export async function POST(req: Request) {

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
    return NextResponse.json({ error: "Supabase env eksik" }, { status: 500 });
  }

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
    return NextResponse.json({ error: "Shopify api_keys eksik" }, { status: 400 });
  }

  // MVP: refunds için önce sipariş listesini alıp her siparişin refunds endpoint'ine gider.
  // Büyük mağazalarda bu işlem pahalıdır; GraphQL bulk ops önerilir.
  const rawOrders = await fetchAllShopifyOrders(creds);

  let updatedItems = 0;
  for (const o of rawOrders) {
    const refunds = await fetchShopifyRefundsForOrder(creds, o.id);
    const refundedQtyByLineItem = aggregateRefundedQuantities(refunds);
    for (const [externalLineItemId, returned_quantity] of refundedQtyByLineItem) {
      const { error: updErr } = await supabase
        .from("order_items")
        .update({ returned_quantity })
        .eq("store_id", storeId)
        .eq("external_line_item_id", externalLineItemId);
      if (!updErr) updatedItems += 1;
    }
  }

  return NextResponse.json({ ok: true, updatedItems });
}

