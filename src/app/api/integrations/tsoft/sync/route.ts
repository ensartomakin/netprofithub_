import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchAllTsoftProducts,
  normalizeTsoftProducts,
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

  const results: Array<{ storeId: string; synced: number; error?: string }> = [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getTsoftCreds(store.api_keys);
      if (!creds) { results.push({ storeId: store.id, synced: 0, error: "Missing api_keys" }); continue; }

      const products = await fetchAllTsoftProducts(creds);
      const normalized = normalizeTsoftProducts(products);

      if (normalized.length === 0) { results.push({ storeId: store.id, synced: 0 }); continue; }

      const { error: upsertError } = await admin.from("products").upsert(
        normalized.map((p) => ({ store_id: store.id, sku: p.sku, name: p.name, stock_level: p.stock_level, status: p.status })),
        { onConflict: "store_id,sku" }
      );
      if (upsertError) throw upsertError;

      results.push({ storeId: store.id, synced: normalized.length });
    } catch (e) {
      results.push({ storeId: store.id, synced: 0, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
