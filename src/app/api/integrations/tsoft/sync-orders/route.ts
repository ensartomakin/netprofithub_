import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchAllTsoftOrders,
  normalizeTsoftOrders,
  getTsoftCreds,
} from "@/lib/integrations/tsoft";

type StoreRow = { id: string; platform: string; api_keys: unknown };

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
    .eq("platform", "tsoft");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ storeId: string; syncedOrders: number; syncedItems: number; error?: string }> = [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getTsoftCreds(store.api_keys);
      if (!creds) { results.push({ storeId: store.id, syncedOrders: 0, syncedItems: 0, error: "Missing api_keys" }); continue; }

      const rawOrders = await fetchAllTsoftOrders(creds);
      const normalized = normalizeTsoftOrders(rawOrders);

      if (normalized.orders.length === 0) { results.push({ storeId: store.id, syncedOrders: 0, syncedItems: 0 }); continue; }

      const { error: ordersErr } = await admin.from("orders").upsert(
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
      if (ordersErr) throw ordersErr;

      const externalIds = normalized.orders.map((o) => o.external_order_id);
      const { data: orderRows, error: fetchErr } = await admin
        .from("orders")
        .select("id,external_order_id")
        .eq("store_id", store.id)
        .in("external_order_id", externalIds);
      if (fetchErr) throw fetchErr;

      const orderIdByExternal = new Map<number, string>();
      for (const r of orderRows ?? []) orderIdByExternal.set(Number(r.external_order_id), String(r.id));

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
        const { error: itemsErr } = await admin.from("order_items").upsert(itemsPayload, { onConflict: "store_id,external_line_item_id" });
        if (itemsErr) throw itemsErr;
      }

      results.push({ storeId: store.id, syncedOrders: normalized.orders.length, syncedItems: itemsPayload.length });
    } catch (e) {
      results.push({ storeId: store.id, syncedOrders: 0, syncedItems: 0, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
