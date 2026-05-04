export type TsoftCredentials = {
  baseUrl: string;   // e.g. https://magaza.tsoft.com.tr
  apiKey: string;
  apiSecret: string;
};

// ─── Raw API response wrapper ──────────────────────────────────────────────────
// Tsoft returns: { status: true/false, message: "...", errorCode: "...", data: [...] }

type TsoftResponse<T> = {
  status?: boolean;
  message?: string;
  errorCode?: string;
  data?: T | T[];
  // some Tsoft versions use these top-level keys
  Data?: T[];
  Success?: boolean;
  TotalCount?: number;
};

// ─── Raw entity types ──────────────────────────────────────────────────────────

type TsoftProductVariant = {
  variantId?: number | string;
  VariantId?: number | string;
  sku?: string;
  Sku?: string;
  barcode?: string;
  Barcode?: string;
  stockAmount?: number | string;
  StockAmount?: number | string;
  price?: number | string;
  Price?: number | string;
  status?: number | string;
  Status?: number | string;
};

type TsoftProduct = {
  productId?: number | string;
  ProductId?: number | string;
  id?: number | string;
  name?: string;
  Name?: string;
  sku?: string;
  Sku?: string;
  barcode?: string;
  Barcode?: string;
  stockAmount?: number | string;
  StockAmount?: number | string;
  stock?: number | string;
  status?: number | string | boolean;
  Status?: number | string | boolean;
  isActive?: boolean;
  variants?: TsoftProductVariant[];
  Variants?: TsoftProductVariant[];
};

type TsoftOrderLine = {
  lineId?: number | string;
  LineId?: number | string;
  id?: number | string;
  productId?: number | string;
  sku?: string;
  Sku?: string;
  productName?: string;
  ProductName?: string;
  name?: string;
  quantity?: number | string;
  Quantity?: number | string;
  unitPrice?: number | string;
  UnitPrice?: number | string;
  price?: number | string;
  discount?: number | string;
  Discount?: number | string;
};

type TsoftOrder = {
  orderId?: number | string;
  OrderId?: number | string;
  id?: number | string;
  createdDate?: string;
  CreatedDate?: string;
  orderDate?: string;
  insertDate?: string;
  status?: string | number;
  Status?: string | number;
  orderStatus?: string;
  totalPrice?: number | string;
  TotalPrice?: number | string;
  total?: number | string;
  taxTotal?: number | string;
  TaxTotal?: number | string;
  tax?: number | string;
  shippingTotal?: number | string;
  ShippingTotal?: number | string;
  shippingPrice?: number | string;
  customerId?: number | string;
  CustomerId?: number | string;
  lines?: TsoftOrderLine[];
  Lines?: TsoftOrderLine[];
  orderLines?: TsoftOrderLine[];
  products?: TsoftOrderLine[];
};

type TsoftReturn = {
  returnId?: number | string;
  ReturnId?: number | string;
  id?: number | string;
  orderId?: number | string;
  OrderId?: number | string;
  createdDate?: string;
  CreatedDate?: string;
  lines?: Array<{ lineId?: number | string; orderLineId?: number | string; OrderLineId?: number | string; quantity?: number | string; Quantity?: number | string }>;
  Lines?: Array<{ lineId?: number | string; orderLineId?: number | string; OrderLineId?: number | string; quantity?: number | string; Quantity?: number | string }>;
};

// ─── HTTP helper ────────────────────────────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
  return s.replace(/\/$/, "");
}

// Tsoft API uses POST with JSON body and API credentials in headers or body.
// Auth: ApiKey + ApiSecret passed as headers (common pattern).
function buildHeaders(creds: TsoftCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ApiKey: creds.apiKey,
    ApiSecret: creds.apiSecret,
    // Some versions also use these header names:
    "X-Api-Key": creds.apiKey,
    "X-Api-Secret": creds.apiSecret,
  };
}

export async function tsoftPost<T>(
  creds: TsoftCredentials,
  path: string,
  body: Record<string, unknown> = {}
): Promise<T[]> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const url = `${base}/api${path}`;
  const headers = buildHeaders(creds);

  // Include credentials in body as well (some Tsoft versions require it)
  const fullBody = {
    ApiKey: creds.apiKey,
    ApiSecret: creds.apiSecret,
    ...body,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(fullBody),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  let json: TsoftResponse<T>;
  try {
    json = JSON.parse(text) as TsoftResponse<T>;
  } catch {
    throw new Error(`Tsoft API hata: ${res.status} ${res.statusText} (${path}) ${text.slice(0, 200)}`);
  }

  // Tsoft returns status:false on errors even with HTTP 200
  if (json.status === false) {
    throw new Error(
      `Tsoft API hata: ${json.message ?? "Bilinmeyen hata"} [${json.errorCode ?? ""}] (${path})`
    );
  }

  if (!res.ok && !json.status) {
    throw new Error(`Tsoft API hata: ${res.status} (${path}) ${text.slice(0, 200)}`);
  }

  // Extract data array from various response shapes
  const data = json.data ?? json.Data;
  if (Array.isArray(data)) return data as T[];
  if (data != null) return [data] as T[];
  return [];
}

// ─── Products ───────────────────────────────────────────────────────────────────

// Common Tsoft product endpoints (tried in order until one works)
const PRODUCT_ENDPOINTS = [
  "/product/list",
  "/products",
  "/Product/GetList",
  "/Product/List",
  "/urun/liste",
];

export async function fetchAllTsoftProducts(creds: TsoftCredentials): Promise<TsoftProduct[]> {
  let workingEndpoint: string | null = null;

  // Find working endpoint on first call
  for (const ep of PRODUCT_ENDPOINTS) {
    try {
      const batch = await tsoftPost<TsoftProduct>(creds, ep, { Page: 1, PageSize: 1 });
      if (batch.length >= 0) { workingEndpoint = ep; break; }
    } catch {
      // try next
    }
  }

  if (!workingEndpoint) {
    throw new Error(
      `Tsoft ürün endpoint'i bulunamadı. Denenen: ${PRODUCT_ENDPOINTS.join(", ")}. ` +
      "Tsoft yönetici panelinizden API dokümantasyonunu kontrol edin."
    );
  }

  const products: TsoftProduct[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 200; i++) {
    const batch = await tsoftPost<TsoftProduct>(creds, workingEndpoint, { Page: page, PageSize: pageSize });
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

function coalesce<T>(...args: (T | undefined | null)[]): T | undefined {
  for (const a of args) if (a != null) return a;
  return undefined;
}

function isActive(p: TsoftProduct): boolean {
  const status = coalesce(p.status, p.Status);
  const active = coalesce(p.isActive);
  if (active != null) return Boolean(active);
  if (status == null) return true;
  const s = String(status).toLowerCase();
  return s === "1" || s === "true" || s === "aktif" || s === "active";
}

export function normalizeTsoftProducts(products: TsoftProduct[]): NormalizedProduct[] {
  const rows: NormalizedProduct[] = [];

  for (const p of products) {
    const name = String(coalesce(p.name, p.Name) ?? "").trim();
    const baseSku = String(coalesce(p.sku, p.Sku, p.barcode, p.Barcode) ?? "").trim();
    const baseStock = toNum(coalesce(p.stockAmount, p.StockAmount, p.stock));
    const baseStatusVal: "aktif" | "pasif" = isActive(p) ? "aktif" : "pasif";
    const variants = coalesce(p.variants, p.Variants) ?? [];

    if (variants.length > 0) {
      for (const v of variants) {
        const sku = String(coalesce(v.sku, v.Sku, v.barcode, v.Barcode) ?? "").trim();
        if (!sku) continue;
        const vStatus = coalesce(v.status, v.Status);
        const vActive = vStatus == null || String(vStatus) === "1" || String(vStatus).toLowerCase() === "true";
        rows.push({
          sku,
          name,
          stock_level: toNum(coalesce(v.stockAmount, v.StockAmount)),
          status: vActive ? "aktif" : "pasif",
        });
      }
    } else {
      if (!baseSku) continue;
      rows.push({ sku: baseSku, name, stock_level: baseStock, status: baseStatusVal });
    }
  }

  return rows;
}

// ─── Orders ─────────────────────────────────────────────────────────────────────

const ORDER_ENDPOINTS = [
  "/order/list",
  "/orders",
  "/Order/GetList",
  "/Order/List",
  "/siparis/liste",
];

export async function fetchAllTsoftOrders(creds: TsoftCredentials): Promise<TsoftOrder[]> {
  let workingEndpoint: string | null = null;

  for (const ep of ORDER_ENDPOINTS) {
    try {
      const batch = await tsoftPost<TsoftOrder>(creds, ep, { Page: 1, PageSize: 1 });
      if (batch.length >= 0) { workingEndpoint = ep; break; }
    } catch {
      // try next
    }
  }

  if (!workingEndpoint) {
    throw new Error(
      `Tsoft sipariş endpoint'i bulunamadı. Denenen: ${ORDER_ENDPOINTS.join(", ")}`
    );
  }

  const orders: TsoftOrder[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 500; i++) {
    const batch = await tsoftPost<TsoftOrder>(creds, workingEndpoint, { Page: page, PageSize: pageSize });
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
  if (s.includes("iptal") || s.includes("cancel")) return "iptal";
  if (s.includes("iade") || s.includes("refund") || s.includes("return")) return "iade";
  if (s.includes("odendi") || s.includes("paid") || s.includes("complet") || s.includes("teslim") || s.includes("deliver")) return "odendi";
  return "beklemede";
}

export function normalizeTsoftOrders(orders: TsoftOrder[]) {
  const normalizedOrders: NormalizedOrder[] = [];
  const normalizedItems: NormalizedOrderItem[] = [];

  for (const o of orders) {
    const external_order_id = toNum(coalesce(o.orderId, o.OrderId, o.id));
    if (!external_order_id) continue;

    const rawDate = coalesce(o.createdDate, o.CreatedDate, o.orderDate, o.insertDate);
    const ordered_at = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
    const rawStatus = coalesce(o.orderStatus, o.status, o.Status);

    normalizedOrders.push({
      external_order_id,
      amount: toNum(coalesce(o.totalPrice, o.TotalPrice, o.total)),
      tax: toNum(coalesce(o.taxTotal, o.TaxTotal, o.tax)),
      shipping: toNum(coalesce(o.shippingTotal, o.ShippingTotal, o.shippingPrice)),
      status: mapOrderStatus(rawStatus),
      customer_id: coalesce(o.customerId, o.CustomerId) != null ? String(coalesce(o.customerId, o.CustomerId)) : null,
      ordered_at,
    });

    const lines = coalesce(o.lines, o.Lines, o.orderLines, o.products) ?? [];
    for (const li of lines) {
      const lineId = toNum(coalesce(li.lineId, li.LineId, li.id));
      const sku = String(coalesce(li.sku, li.Sku) ?? "").trim();
      if (!lineId || !sku) continue;

      normalizedItems.push({
        external_line_item_id: lineId,
        external_order_id,
        sku,
        name: String(coalesce(li.productName, li.ProductName, li.name, sku)).trim(),
        quantity: toNum(coalesce(li.quantity, li.Quantity)),
        unit_price: toNum(coalesce(li.unitPrice, li.UnitPrice, li.price)),
        discount: toNum(coalesce(li.discount, li.Discount)),
        returned_quantity: 0,
        ordered_at,
      });
    }
  }

  return { orders: normalizedOrders, items: normalizedItems };
}

// ─── Returns ────────────────────────────────────────────────────────────────────

const RETURN_ENDPOINTS = [
  "/return/list",
  "/returns",
  "/Return/GetList",
  "/Return/List",
  "/iade/liste",
];

export async function fetchAllTsoftReturns(creds: TsoftCredentials): Promise<TsoftReturn[]> {
  let workingEndpoint: string | null = null;

  for (const ep of RETURN_ENDPOINTS) {
    try {
      const batch = await tsoftPost<TsoftReturn>(creds, ep, { Page: 1, PageSize: 1 });
      if (batch.length >= 0) { workingEndpoint = ep; break; }
    } catch {
      // try next
    }
  }

  if (!workingEndpoint) {
    // Returns are optional — don't throw, return empty
    return [];
  }

  const returns: TsoftReturn[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 200; i++) {
    const batch = await tsoftPost<TsoftReturn>(creds, workingEndpoint, { Page: page, PageSize: pageSize });
    if (batch.length === 0) break;
    returns.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  return returns;
}

export function aggregateTsoftReturnedQuantities(returns: TsoftReturn[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of returns) {
    const lines = coalesce(r.lines, r.Lines) ?? [];
    for (const line of lines) {
      const lineId = toNum(coalesce(line.orderLineId, line.OrderLineId, line.lineId));
      const qty = toNum(coalesce(line.quantity, line.Quantity));
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
  const src = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : any;
  const baseUrl = typeof src.base_url === "string" ? src.base_url.trim() : "";
  const apiKey = typeof src.api_key === "string" ? src.api_key.trim() : "";
  const apiSecret = typeof src.api_secret === "string" ? src.api_secret.trim() : "";
  if (!baseUrl || !apiKey || !apiSecret) return null;
  return { baseUrl, apiKey, apiSecret };
}
