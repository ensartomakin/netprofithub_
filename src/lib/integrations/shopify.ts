export type ShopifyCredentials = {
  shopDomain: string; // example: myshop.myshopify.com
  accessToken: string;
  apiVersion?: string; // example: 2024-10
};

type ShopifyProduct = {
  id: number;
  title: string;
  status?: string;
  variants: Array<{
    id: number;
    title: string;
    sku: string | null;
    inventory_quantity: number | null;
  }>;
};

type ShopifyOrder = {
  id: number;
  created_at: string;
  cancelled_at: string | null;
  financial_status: string | null;
  total_price: string;
  total_tax: string;
  total_discounts: string;
  currency: string;
  customer: { id: number } | null;
  total_shipping_price_set?: {
    shop_money?: { amount: string; currency_code: string };
  };
  line_items: Array<{
    id: number;
    sku: string | null;
    name: string | null;
    title: string | null;
    quantity: number;
    price: string;
    total_discount: string;
  }>;
};

type ShopifyRefund = {
  id: number;
  created_at: string;
  refund_line_items: Array<{
    line_item_id: number;
    quantity: number;
  }>;
};

function normalizeShopDomain(input: string) {
  const s = input.trim().toLowerCase();
  if (!s) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    try {
      const u = new URL(s);
      return u.host;
    } catch {
      return s;
    }
  }
  return s;
}

export async function shopifyFetchJson<T>(
  creds: ShopifyCredentials,
  path: string
): Promise<T> {
  const apiVersion = creds.apiVersion ?? "2024-10";
  const shopDomain = normalizeShopDomain(creds.shopDomain);
  const url = `https://${shopDomain}/admin/api/${apiVersion}${path}`;

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": creds.accessToken,
      "Content-Type": "application/json",
    },
    // Vercel/Next: do not cache integration calls by default
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Shopify API hata: ${res.status} ${res.statusText} (${path}) ${text}`
    );
  }

  return (await res.json()) as T;
}

export async function fetchAllShopifyProducts(creds: ShopifyCredentials) {
  // MVP: REST pagination via since_id (works for basic full sync)
  // Note: Daha büyük mağazalarda GraphQL + cursor pagination önerilir.
  const products: ShopifyProduct[] = [];
  let sinceId = 0;

  for (let i = 0; i < 50; i++) {
    const json = await shopifyFetchJson<{ products: ShopifyProduct[] }>(
      creds,
      `/products.json?limit=250&since_id=${sinceId}`
    );
    const batch = json.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    sinceId = batch[batch.length - 1]!.id;
  }

  return products;
}

export async function fetchAllShopifyOrders(creds: ShopifyCredentials) {
  // MVP: full sync using since_id; larger stores should use cursor pagination.
  const orders: ShopifyOrder[] = [];
  let sinceId = 0;

  for (let i = 0; i < 100; i++) {
    const json = await shopifyFetchJson<{ orders: ShopifyOrder[] }>(
      creds,
      `/orders.json?limit=250&status=any&since_id=${sinceId}`
    );
    const batch = json.orders ?? [];
    if (batch.length === 0) break;
    orders.push(...batch);
    sinceId = batch[batch.length - 1]!.id;
  }

  return orders;
}

export async function fetchShopifyRefundsForOrder(
  creds: ShopifyCredentials,
  orderId: number
) {
  const json = await shopifyFetchJson<{ refunds: ShopifyRefund[] }>(
    creds,
    `/orders/${orderId}/refunds.json`
  );
  return json.refunds ?? [];
}

export type NormalizedProduct = {
  sku: string;
  name: string;
  stock_level: number;
  status: "aktif" | "pasif";
};

export function normalizeShopifyProducts(products: ShopifyProduct[]) {
  const rows: NormalizedProduct[] = [];

  for (const p of products) {
    const pTitle = String(p.title ?? "").trim();
    const statusRaw = String(p.status ?? "").toLowerCase();
    const status: "aktif" | "pasif" = statusRaw === "active" ? "aktif" : "pasif";

    for (const v of p.variants ?? []) {
      const sku = String(v.sku ?? "").trim();
      if (!sku) continue;
      const vTitle = String(v.title ?? "").trim();
      const name =
        vTitle && vTitle !== "Default Title" ? `${pTitle} - ${vTitle}` : pTitle;
      rows.push({
        sku,
        name,
        stock_level: Number(v.inventory_quantity ?? 0),
        status,
      });
    }
  }

  return rows;
}

export type NormalizedOrder = {
  external_order_id: number;
  amount: number;
  tax: number;
  shipping: number;
  status: "odendi" | "iade" | "iptal" | "beklemede";
  customer_id: string | null;
  ordered_at: string;
};

export type NormalizedOrderItem = {
  external_line_item_id: number;
  external_order_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  returned_quantity: number; // MVP: refunds line item mapping sonraya
  ordered_at: string;
};

function toNumber(v: unknown) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapOrderStatus(order: ShopifyOrder): NormalizedOrder["status"] {
  if (order.cancelled_at) return "iptal";
  const fs = String(order.financial_status ?? "").toLowerCase();
  if (fs === "refunded" || fs === "partially_refunded") return "iade";
  if (fs === "paid" || fs === "partially_paid") return "odendi";
  if (fs === "pending" || fs === "authorized") return "beklemede";
  return "beklemede";
}

export function normalizeShopifyOrders(orders: ShopifyOrder[]) {
  const normalizedOrders: NormalizedOrder[] = [];
  const normalizedItems: NormalizedOrderItem[] = [];

  for (const o of orders) {
    const shipping = toNumber(o.total_shipping_price_set?.shop_money?.amount ?? 0);
    const status = mapOrderStatus(o);
    const ordered_at = o.created_at;

    normalizedOrders.push({
      external_order_id: o.id,
      amount: toNumber(o.total_price),
      tax: toNumber(o.total_tax),
      shipping,
      status,
      customer_id: o.customer?.id != null ? String(o.customer.id) : null,
      ordered_at,
    });

    for (const li of o.line_items ?? []) {
      const sku = String(li.sku ?? "").trim();
      if (!sku) continue;
      const name = String(li.title ?? li.name ?? sku).trim();
      normalizedItems.push({
        external_line_item_id: li.id,
        external_order_id: o.id,
        sku,
        name,
        quantity: Number(li.quantity ?? 0),
        unit_price: toNumber(li.price),
        discount: toNumber(li.total_discount),
        returned_quantity: 0,
        ordered_at,
      });
    }
  }

  return { orders: normalizedOrders, items: normalizedItems };
}

export function aggregateRefundedQuantities(refunds: ShopifyRefund[]) {
  const map = new Map<number, number>(); // line_item_id -> qty
  for (const r of refunds ?? []) {
    for (const li of r.refund_line_items ?? []) {
      const id = Number(li.line_item_id);
      const qty = Number(li.quantity ?? 0);
      if (!Number.isFinite(id) || !Number.isFinite(qty)) continue;
      map.set(id, (map.get(id) ?? 0) + qty);
    }
  }
  return map;
}
