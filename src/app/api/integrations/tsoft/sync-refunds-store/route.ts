import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllTsoftReturns,
  aggregateTsoftReturnedQuantities,
  getTsoftCreds,
} from "@/lib/integrations/tsoft";

export async function POST(req: Request) {

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

  const returns = await fetchAllTsoftReturns(creds);
  const qtyMap = aggregateTsoftReturnedQuantities(returns);

  let updatedItems = 0;
  for (const [externalLineItemId, returned_quantity] of qtyMap) {
    const { error: updErr } = await supabase
      .from("order_items")
      .update({ returned_quantity })
      .eq("store_id", storeId)
      .eq("external_line_item_id", externalLineItemId);
    if (!updErr) updatedItems++;
  }

  return NextResponse.json({ ok: true, updatedItems });
}
