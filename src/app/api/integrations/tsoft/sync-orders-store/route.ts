import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDemoMode } from "@/lib/demo/mode";
import {
  fetchAllTsoftOrders,
  normalizeTsoftOrders,
  getTsoftCreds,
} from "@/lib/integrations/tsoft";

export async function POST(req: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, syncedOrders: 10, syncedItems: 24, demo: true });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = (await req.json().catch(() => ({}))) as { storeId?: string };
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.json({ error: "Supabase env eksik" }, { status: 500 });

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id,platform,api_keys")
    .eq("id", storeId)
    .single();

  if (storeError) return NextResponse.json({ error: storeError.message }, { status: 400 });
  if (store.platform !== "tsoft") return NextResponse.json({ error: "Store platform tsoft değil" }, { status: 400 });

  const creds = getTsoftCreds(store.api_keys);
  if (!creds) return NextResponse.json({ error: "Tsoft api_keys eksik" }, { status: 400 });

  const rawOrders = await fetchAllTsoftOrders(creds);
  const normalized = normalizeTsoftOrders(rawOrders);

  if (normalized.orders.length === 0) return NextResponse.json({ ok: true, syncedOrders: 0, syncedItems: 0 });

  const { error: ordersErr } = await supabase.from("orders").upsert(
    normalized.orders.map((o) => ({
      store_id: storeId,
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
  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

  const externalIds = normalized.orders.map((o) => o.external_order_id);
  const { data: orderRows, error: fetchErr } = await supabase
    .from("orders")
    .select("id,external_order_id")
    .eq("store_id", storeId)
    .in("external_order_id", externalIds);
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  const orderIdByExternal = new Map<number, string>();
  for (const r of orderRows ?? []) orderIdByExternal.set(Number(r.external_order_id), String(r.id));

  const itemsPayload = normalized.items.map((it) => ({
    store_id: storeId,
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
    const { error: itemsErr } = await supabase.from("order_items").upsert(itemsPayload, { onConflict: "store_id,external_line_item_id" });
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, syncedOrders: normalized.orders.length, syncedItems: itemsPayload.length });
}
