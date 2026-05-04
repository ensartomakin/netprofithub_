import { createHmac } from "crypto";

export type TsoftCredentials = {
  baseUrl: string;   // e.g. https://magaza.tsoft.com.tr
  apiKey: string;
  apiSecret: string;
};

// ─── Raw API types ─────────────────────────────────────────────────────────────

type TsoftProductVariant = {
  VariantId?: number | string;
  Sku?: string;
  Barcode?: string;
  StockAmount?: number | string;
  Price?: number | string;
  Status?: number | string; // 1 = aktif, 0 = pasif
};

type TsoftProduct = {
  ProductId?: number | string;
  Name?: string;
  Sku?: string;
  Barcode?: string;
  StockAmount?: number | string;
  Status?: number | string;
  Variants?: TsoftProductVariant[];
};

type TsoftOrderLine = {
  LineId?: number | string;
  ProductId?: number | string;
  Sku?: string;
  ProductName?: string;
  Quantity?: number | string;
  UnitPrice?: number | string;
  Discount?: number | string;
};

type TsoftOrder = {
  OrderId?: number | string;
  CreatedDate?: string;
  Status?: string | number;
  TotalPrice?: number | string;
  TaxTotal?: number | string;
  ShippingTotal?: number | string;
  CustomerId?: number | string;
  Lines?: TsoftOrderLine[];
};

type TsoftReturnLine = {
  LineId?: number | string;
  OrderLineId?: number | string;
  Quantity?: number | string;
};

type TsoftReturn = {
  ReturnId?: number | string;
  OrderId?: number | string;
  CreatedDate?: string;
  Lines?: TsoftReturnLine[];
};

type TsoftPagedResponse<T> = {
  Success?: boolean;
  TotalCount?: number;
  PageSize?: number;
  CurrentPage?: number;
  Data?: T[];
  // some versions wrap differently
  Products?: TsoftProduct[];
  Orders?: TsoftOrder[];
  Returns?: TsoftReturn[];
};

// ─── HTTP helper ────────────────────────────────────────────────────────────────

function buildAuthHeaders(creds: TsoftCredentials): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", creds.apiSecret)
    .update(creds.apiKey + timestamp)
    .digest("hex");
  return {
    "X-Api-Key": creds.apiKey,
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
  return s.replace(/\/$/, "");
}

export async function tsoftFetchJson<T>(
  creds: TsoftCredentials,
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const url = `${base}/api${path}`;
  const headers = buildAuthHeaders(creds);

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tsoft API hata: ${res.status} ${res.statusText} (${path}) ${text}`);
  }

  return (await res.json()) as T;
}

// ─── Products ───────────────────────────────────────────────────────────────────

export async function fetchAllTsoftProducts(creds: TsoftCredentials): Promise<TsoftProduct[]> {
  const products: TsoftProduct[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 200; i++) {
    const json = await tsoftFetchJson<TsoftPagedResponse<TsoftProduct>>(
      creds,
      `/product/list?page=${page}&pageSize=${pageSize}`
    );

    const batch: TsoftProduct[] = json.Data ?? json.Products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  return products;
}

export type NormalizedProduct = {
  sku: string;
  name: string;
  stock_level: number;
  status: "aktif" | "pasif";
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeTsoftProducts(products: TsoftProduct[]): NormalizedProduct[] {
  const rows: NormalizedProduct[] = [];

  for (const p of products) {
    const baseName = String(p.Name ?? "").trim();
    const baseSku = String(p.Sku ?? p.Barcode ?? "").trim();
    const baseStock = toNum(p.StockAmount);
    const baseStatus = Number(p.Status) === 0 ? "pasif" : "aktif";

    const variants = p.Variants ?? [];

    if (variants.length > 0) {
      for (const v of variants) {
        const sku = String(v.Sku ?? v.Barcode ?? "").trim();
        if (!sku) continue;
        rows.push({
          sku,
          name: baseName,
          stock_level: toNum(v.StockAmount),
          status: Number(v.Status) === 0 ? "pasif" : "aktif",
        });
      }
    } else {
      if (!baseSku) continue;
      rows.push({ sku: baseSku, name: baseName, stock_level: baseStock, status: baseStatus });
    }
  }

  return rows;
}

// ─── Orders ─────────────────────────────────────────────────────────────────────

export async function fetchAllTsoftOrders(creds: TsoftCredentials): Promise<TsoftOrder[]> {
  const orders: TsoftOrder[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 500; i++) {
    const json = await tsoftFetchJson<TsoftPagedResponse<TsoftOrder>>(
      creds,
      `/order/list?page=${page}&pageSize=${pageSize}`
    );

    const batch: TsoftOrder[] = json.Data ?? json.Orders ?? [];
    if (batch.length === 0) break;
    orders.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  return orders;
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
  returned_quantity: number;
  ordered_at: string;
};

function mapOrderStatus(raw: unknown): NormalizedOrder["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s === "iptal" || s === "cancelled" || s === "cancel") return "iptal";
  if (s === "iade" || s === "refund" || s === "returned" || s === "return") return "iade";
  if (s === "odendi" || s === "paid" || s === "completed" || s === "delivered") return "odendi";
  return "beklemede";
}

export function normalizeTsoftOrders(orders: TsoftOrder[]) {
  const normalizedOrders: NormalizedOrder[] = [];
  const normalizedItems: NormalizedOrderItem[] = [];

  for (const o of orders) {
    const external_order_id = toNum(o.OrderId);
    if (!external_order_id) continue;

    const ordered_at = o.CreatedDate
      ? new Date(o.CreatedDate).toISOString()
      : new Date().toISOString();

    normalizedOrders.push({
      external_order_id,
      amount: toNum(o.TotalPrice),
      tax: toNum(o.TaxTotal),
      shipping: toNum(o.ShippingTotal),
      status: mapOrderStatus(o.Status),
      customer_id: o.CustomerId != null ? String(o.CustomerId) : null,
      ordered_at,
    });

    for (const li of o.Lines ?? []) {
      const lineId = toNum(li.LineId);
      const sku = String(li.Sku ?? "").trim();
      if (!lineId || !sku) continue;

      normalizedItems.push({
        external_line_item_id: lineId,
        external_order_id,
        sku,
        name: String(li.ProductName ?? sku).trim(),
        quantity: toNum(li.Quantity),
        unit_price: toNum(li.UnitPrice),
        discount: toNum(li.Discount),
        returned_quantity: 0,
        ordered_at,
      });
    }
  }

  return { orders: normalizedOrders, items: normalizedItems };
}

// ─── Returns (refunds) ──────────────────────────────────────────────────────────

export async function fetchAllTsoftReturns(creds: TsoftCredentials): Promise<TsoftReturn[]> {
  const returns: TsoftReturn[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 200; i++) {
    const json = await tsoftFetchJson<TsoftPagedResponse<TsoftReturn>>(
      creds,
      `/return/list?page=${page}&pageSize=${pageSize}`
    );

    const batch: TsoftReturn[] = json.Data ?? json.Returns ?? [];
    if (batch.length === 0) break;
    returns.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  return returns;
}

// Maps external_line_item_id -> returned_quantity
export function aggregateTsoftReturnedQuantities(returns: TsoftReturn[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of returns) {
    for (const line of r.Lines ?? []) {
      const lineId = toNum(line.OrderLineId ?? line.LineId);
      const qty = toNum(line.Quantity);
      if (!lineId || !qty) continue;
      map.set(lineId, (map.get(lineId) ?? 0) + qty);
    }
  }
  return map;
}

// ─── Credential extractor ───────────────────────────────────────────────────────

export function getTsoftCreds(apiKeys: unknown): TsoftCredentials | null {
  if (!apiKeys || typeof apiKeys !== "object") return null;
  const any = apiKeys as Record<string, unknown>;

  const nested = any["tsoft"];
  const src = nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)
    : any;

  const baseUrl = typeof src.base_url === "string" ? src.base_url.trim() : "";
  const apiKey = typeof src.api_key === "string" ? src.api_key.trim() : "";
  const apiSecret = typeof src.api_secret === "string" ? src.api_secret.trim() : "";

  if (!baseUrl || !apiKey || !apiSecret) return null;
  return { baseUrl, apiKey, apiSecret };
}
