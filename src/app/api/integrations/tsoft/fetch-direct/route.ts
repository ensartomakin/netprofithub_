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
  apiUser?: string; apiPass?: string;
  apiKey?: string;  apiSecret?: string;
  type?: "products" | "orders" | "returns";
};

export async function POST(req: Request) {
  let body: RequestBody = {};
  try { body = (await req.json()) as RequestBody; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { baseUrl, type = "products" } = body;
  const apiUser = body.apiUser ?? body.apiKey ?? "";
  const apiPass = body.apiPass ?? body.apiSecret ?? "";

  if (!baseUrl || !apiUser || !apiPass) {
    return NextResponse.json({ error: "baseUrl, apiUser (veya apiKey), apiPass (veya apiSecret) gerekli" }, { status: 400 });
  }

  const creds: TsoftCredentials = { baseUrl, apiUser, apiPass };

  try {
    if (type === "products") {
      const raw = await fetchAllTsoftProducts(creds);
      const normalized = normalizeTsoftProducts(raw);
      return NextResponse.json({ ok: true, type: "products", count: normalized.length, products: normalized });
    }

    if (type === "orders") {
      const raw = await fetchAllTsoftOrders(creds);
      const normalized = normalizeTsoftOrders(raw);
      return NextResponse.json({ ok: true, type: "orders", count: normalized.orders.length, orders: normalized.orders, items: normalized.items });
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
