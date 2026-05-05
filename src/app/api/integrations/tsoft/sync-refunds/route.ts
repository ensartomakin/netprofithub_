import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  fetchAllTsoftReturns,
  aggregateTsoftReturnedQuantities,
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

  const results: Array<{ storeId: string; updatedItems: number; error?: string }> = [];

  for (const store of (stores ?? []) as StoreRow[]) {
    try {
      const creds = getTsoftCreds(store.api_keys);
      if (!creds) { results.push({ storeId: store.id, updatedItems: 0, error: "Missing api_keys" }); continue; }

      const returns = await fetchAllTsoftReturns(creds);
      const qtyMap = aggregateTsoftReturnedQuantities(returns);

      let updatedItems = 0;
      for (const [externalLineItemId, returned_quantity] of qtyMap) {
        const { error: updErr } = await admin
          .from("order_items")
          .update({ returned_quantity })
          .eq("store_id", store.id)
          .eq("external_line_item_id", externalLineItemId);
        if (!updErr) updatedItems++;
      }

      results.push({ storeId: store.id, updatedItems });
    } catch (e) {
      results.push({ storeId: store.id, updatedItems: 0, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
