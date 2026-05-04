import { NextResponse } from "next/server";
import {
  fetchAllTsoftProducts,
  normalizeTsoftProducts,
  fetchAllTsoftOrders,
  normalizeTsoftOrders,
  fetchAllTsoftReturns,
  aggregateTsoftReturnedQuantities,
  type TsoftCredentials,
} from "@/lib/integrations/tsoft";

type RequestBody = {
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  type?: "products" | "orders" | "returns";
  limit?: number;
};

// Direct Tsoft fetch — no Supabase required.
// Used in demo mode when the user wants real data without a DB.
export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { baseUrl, apiKey, apiSecret, type = "products", limit } = body;

  if (!baseUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "baseUrl, apiKey, apiSecret gerekli" }, { status: 400 });
  }

  const creds: TsoftCredentials = { baseUrl, apiKey, apiSecret };

  try {
    if (type === "products") {
      const raw = await fetchAllTsoftProducts(creds);
      const normalized = normalizeTsoftProducts(raw);
      const result = limit ? normalized.slice(0, limit) : normalized;
      return NextResponse.json({ ok: true, type: "products", count: result.length, products: result });
    }

    if (type === "orders") {
      const raw = await fetchAllTsoftOrders(creds);
      const normalized = normalizeTsoftOrders(raw);
      const orders = limit ? normalized.orders.slice(0, limit) : normalized.orders;
      const items = normalized.items.filter((it) =>
        orders.some((o) => o.external_order_id === it.external_order_id)
      );
      return NextResponse.json({ ok: true, type: "orders", count: orders.length, orders, items });
    }

    if (type === "returns") {
      const raw = await fetchAllTsoftReturns(creds);
      const qtyMap = aggregateTsoftReturnedQuantities(raw);
      const returns = Array.from(qtyMap.entries()).map(([lineItemId, qty]) => ({
        external_line_item_id: lineItemId,
        returned_quantity: qty,
      }));
      return NextResponse.json({ ok: true, type: "returns", count: returns.length, returns });
    }

    return NextResponse.json({ error: "type must be products | orders | returns" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tsoft API hatası" },
      { status: 502 }
    );
  }
}
