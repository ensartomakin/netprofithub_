import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllTsoftProducts,
  normalizeTsoftProducts,
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

  const products = await fetchAllTsoftProducts(creds);
  const normalized = normalizeTsoftProducts(products);

  if (normalized.length === 0) return NextResponse.json({ ok: true, synced: 0 });

  const { error: upsertError } = await supabase.from("products").upsert(
    normalized.map((p) => ({ store_id: store.id, sku: p.sku, name: p.name, stock_level: p.stock_level, status: p.status })),
    { onConflict: "store_id,sku" }
  );

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, synced: normalized.length });
}
