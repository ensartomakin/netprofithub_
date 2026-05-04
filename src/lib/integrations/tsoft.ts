export type TsoftCredentials = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
};

// ─── Response types ─────────────────────────────────────────────────────────

type TsoftEnvelope = {
  status?: boolean;
  message?: string;
  errorCode?: string;
  data?: unknown;
  Data?: unknown;
  Success?: boolean;
  TotalCount?: number;
};

type TsoftProductVariant = {
  variantId?: number | string; VariantId?: number | string;
  sku?: string; Sku?: string; barcode?: string; Barcode?: string;
  stockAmount?: number | string; StockAmount?: number | string;
  status?: number | string; Status?: number | string;
};

type TsoftProduct = {
  productId?: number | string; ProductId?: number | string; id?: number | string;
  name?: string; Name?: string; productName?: string; ProductName?: string;
  sku?: string; Sku?: string; barcode?: string; Barcode?: string;
  stockAmount?: number | string; StockAmount?: number | string; stock?: number | string;
  status?: number | string | boolean; Status?: number | string | boolean; isActive?: boolean;
  variants?: TsoftProductVariant[]; Variants?: TsoftProductVariant[];
};

type TsoftOrderLine = {
  lineId?: number | string; LineId?: number | string; id?: number | string;
  sku?: string; Sku?: string;
  productName?: string; ProductName?: string; name?: string;
  quantity?: number | string; Quantity?: number | string;
  unitPrice?: number | string; UnitPrice?: number | string; price?: number | string;
  discount?: number | string; Discount?: number | string;
};

type TsoftOrder = {
  orderId?: number | string; OrderId?: number | string; id?: number | string;
  createdDate?: string; CreatedDate?: string; orderDate?: string; insertDate?: string;
  status?: string | number; Status?: string | number; orderStatus?: string;
  totalPrice?: number | string; TotalPrice?: number | string; total?: number | string;
  taxTotal?: number | string; TaxTotal?: number | string; tax?: number | string;
  shippingTotal?: number | string; ShippingTotal?: number | string; shippingPrice?: number | string;
  customerId?: number | string; CustomerId?: number | string;
  lines?: TsoftOrderLine[]; Lines?: TsoftOrderLine[];
  orderLines?: TsoftOrderLine[]; products?: TsoftOrderLine[];
};

type TsoftReturn = {
  returnId?: number | string; ReturnId?: number | string; id?: number | string;
  orderId?: number | string; OrderId?: number | string;
  lines?: Array<{ lineId?: number | string; orderLineId?: number | string; OrderLineId?: number | string; quantity?: number | string; Quantity?: number | string }>;
  Lines?: Array<{ lineId?: number | string; orderLineId?: number | string; OrderLineId?: number | string; quantity?: number | string; Quantity?: number | string }>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
  return s.replace(/\/$/, "");
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coalesce<T>(...args: (T | undefined | null)[]): T | undefined {
  for (const a of args) if (a != null) return a;
  return undefined;
}

// ─── Raw probe (never throws) ─────────────────────────────────────────────────

export type ProbeResult = {
  url: string;
  method: string;
  httpStatus: number;
  ok: boolean;         // status:true or data array found
  apiStatus?: boolean;
  errorCode?: string;
  message?: string;
  rawSnippet: string;  // first 300 chars of response body
  dataLength?: number; // length of data array if found
};

export async function rawProbe(
  url: string,
  method: "GET" | "POST",
  headers: Record<string, string>,
  body?: Record<string, unknown>
): Promise<ProbeResult> {
  const base: ProbeResult = { url, method, httpStatus: 0, ok: false, rawSnippet: "" };
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text().catch(() => "");
    base.httpStatus = res.status;
    base.rawSnippet = text.slice(0, 300);

    let json: TsoftEnvelope | null = null;
    try { json = JSON.parse(text) as TsoftEnvelope; } catch { /* not JSON */ }

    if (json) {
      base.apiStatus = json.status;
      base.errorCode = json.errorCode;
      base.message = json.message;
      const data = json.data ?? json.Data;
      if (Array.isArray(data)) base.dataLength = data.length;
      // Success = status:true (or not false) AND http ok
      base.ok = json.status === true || (json.status !== false && res.ok);
    } else {
      base.ok = res.ok;
    }
  } catch (e) {
    base.rawSnippet = e instanceof Error ? e.message : String(e);
    base.httpStatus = 0;
  }
  return base;
}

// ─── Probe matrix: tries many URL + method + auth combinations ────────────────

const PRODUCT_PATHS = [
  "/product/list", "/product/getlist", "/product/getproductlist",
  "/products", "/products/list", "/products/getlist",
  "/Product/List", "/Product/GetList", "/Product/GetProductList",
  "/Products", "/Products/List",
  "/urun/liste", "/urun",
  "/catalog/products", "/v1/product/list", "/v2/product/list",
];

const ORDER_PATHS = [
  "/order/list", "/order/getlist", "/order/getorderlist",
  "/orders", "/orders/list",
  "/Order/List", "/Order/GetList", "/Order/GetOrderList",
  "/Orders",
  "/siparis/liste", "/siparis",
  "/v1/order/list", "/v2/order/list",
];

const RETURN_PATHS = [
  "/return/list", "/return/getlist",
  "/returns", "/returns/list",
  "/Return/List", "/Return/GetList",
  "/iade/liste", "/iade",
];

// base URL suffixes to try (prepended to path instead of /api)
const BASE_SUFFIXES = ["", "/api", "/Api", "/webapi", "/rest", "/service"];

export async function diagnose(creds: TsoftCredentials): Promise<ProbeResult[]> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const results: ProbeResult[] = [];

  // Auth variations
  const jsonHeaders = { "Content-Type": "application/json", Accept: "application/json" };
  const authHeaders = {
    ...jsonHeaders,
    ApiKey: creds.apiKey,
    ApiSecret: creds.apiSecret,
    "X-Api-Key": creds.apiKey,
    "X-Api-Secret": creds.apiSecret,
  };
  const bodyWithAuth = { ApiKey: creds.apiKey, ApiSecret: creds.apiSecret, Page: 1, PageSize: 1 };

  // Only probe a subset (first 2 base suffixes × first 5 product paths) to keep it fast
  for (const suffix of BASE_SUFFIXES.slice(0, 3)) {
    for (const path of PRODUCT_PATHS.slice(0, 6)) {
      const url = `${base}${suffix}${path}`;
      const r = await rawProbe(url, "POST", authHeaders, bodyWithAuth);
      results.push(r);
      if (r.ok) return results; // stop on first success
    }
  }
  return results;
}

// ─── Actual data fetcher (uses discovered endpoint) ──────────────────────────

async function discoverAndFetch<T>(
  creds: TsoftCredentials,
  paths: string[],
  paginationBody: (page: number, size: number) => Record<string, unknown>
): Promise<T[]> {
  const base = normalizeBaseUrl(creds.baseUrl);
  const authHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ApiKey: creds.apiKey,
    ApiSecret: creds.apiSecret,
    "X-Api-Key": creds.apiKey,
    "X-Api-Secret": creds.apiSecret,
  };

  // Probe to find working base suffix + path
  let workingUrl: string | null = null;
  for (const suffix of BASE_SUFFIXES) {
    for (const path of paths) {
      const url = `${base}${suffix}${path}`;
      const r = await rawProbe(url, "POST", authHeaders, {
        ApiKey: creds.apiKey,
        ApiSecret: creds.apiSecret,
        ...paginationBody(1, 1),
      });
      if (r.ok) { workingUrl = `${base}${suffix}${path}`; break; }
    }
    if (workingUrl) break;
  }

  if (!workingUrl) {
    // Build a helpful error with sample responses
    const samples: ProbeResult[] = [];
    for (const path of paths.slice(0, 3)) {
      const url = `${base}/api${path}`;
      samples.push(await rawProbe(url, "POST", authHeaders, { ApiKey: creds.apiKey, ApiSecret: creds.apiSecret, ...paginationBody(1, 1) }));
    }
    const detail = samples.map((s) => `${s.url} → [${s.httpStatus}] ${s.rawSnippet.slice(0, 120)}`).join("\n");
    throw new Error(`Tsoft API endpoint bulunamadı.\n${detail}`);
  }

  const items: T[] = [];
  let page = 1;
  const pageSize = 100;

  for (let i = 0; i < 200; i++) {
    const body = { ApiKey: creds.apiKey, ApiSecret: creds.apiSecret, ...paginationBody(page, pageSize) };
    const r = await rawProbe(workingUrl, "POST", authHeaders, body);
    if (!r.ok) break;
    let json: TsoftEnvelope | null = null;
    try { json = JSON.parse(r.rawSnippet) as TsoftEnvelope; } catch { break; }

    // Need full response — rawProbe truncates; re-fetch for full data
    const res = await fetch(workingUrl, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const fullText = await res.text();
    const fullJson = JSON.parse(fullText) as TsoftEnvelope;
    const data = fullJson.data ?? fullJson.Data;
    const batch = Array.isArray(data) ? (data as T[]) : [];
    if (batch.length === 0) break;
    items.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  return items;
}

// ─── Public fetch functions ───────────────────────────────────────────────────

export async function fetchAllTsoftProducts(creds: TsoftCredentials): Promise<TsoftProduct[]> {
  return discoverAndFetch<TsoftProduct>(creds, PRODUCT_PATHS, (p, s) => ({ Page: p, PageSize: s, page: p, pageSize: s, pageNum: p, limit: s }));
}

export async function fetchAllTsoftOrders(creds: TsoftCredentials): Promise<TsoftOrder[]> {
  return discoverAndFetch<TsoftOrder>(creds, ORDER_PATHS, (p, s) => ({ Page: p, PageSize: s, page: p, pageSize: s }));
}

export async function fetchAllTsoftReturns(creds: TsoftCredentials): Promise<TsoftReturn[]> {
  try {
    return await discoverAndFetch<TsoftReturn>(creds, RETURN_PATHS, (p, s) => ({ Page: p, PageSize: s, page: p, pageSize: s }));
  } catch {
    return []; // returns are optional
  }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

export type NormalizedProduct = { sku: string; name: string; stock_level: number; status: "aktif" | "pasif" };

function isProductActive(p: TsoftProduct): boolean {
  const s = coalesce(p.isActive);
  if (s != null) return Boolean(s);
  const v = coalesce(p.status, p.Status);
  if (v == null) return true;
  return String(v) === "1" || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "aktif" || String(v).toLowerCase() === "active";
}

export function normalizeTsoftProducts(products: TsoftProduct[]): NormalizedProduct[] {
  const rows: NormalizedProduct[] = [];
  for (const p of products) {
    const name = String(coalesce(p.name, p.Name, p.productName, p.ProductName) ?? "").trim();
    const baseSku = String(coalesce(p.sku, p.Sku, p.barcode, p.Barcode) ?? "").trim();
    const baseStock = toNum(coalesce(p.stockAmount, p.StockAmount, p.stock));
    const baseActive = isProductActive(p);
    const variants = coalesce(p.variants, p.Variants) ?? [];
    if (variants.length > 0) {
      for (const v of variants) {
        const sku = String(coalesce(v.sku, v.Sku, v.barcode, v.Barcode) ?? "").trim();
        if (!sku) continue;
        const va = coalesce(v.status, v.Status);
        rows.push({ sku, name, stock_level: toNum(coalesce(v.stockAmount, v.StockAmount)), status: (va == null || String(va) === "1" || String(va).toLowerCase() === "true") ? "aktif" : "pasif" });
      }
    } else {
      if (!baseSku) continue;
      rows.push({ sku: baseSku, name, stock_level: baseStock, status: baseActive ? "aktif" : "pasif" });
    }
  }
  return rows;
}

export type NormalizedOrder = { external_order_id: number; amount: number; tax: number; shipping: number; status: "odendi" | "iade" | "iptal" | "beklemede"; customer_id: string | null; ordered_at: string };
export type NormalizedOrderItem = { external_line_item_id: number; external_order_id: number; sku: string; name: string; quantity: number; unit_price: number; discount: number; returned_quantity: number; ordered_at: string };

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
    normalizedOrders.push({
      external_order_id,
      amount: toNum(coalesce(o.totalPrice, o.TotalPrice, o.total)),
      tax: toNum(coalesce(o.taxTotal, o.TaxTotal, o.tax)),
      shipping: toNum(coalesce(o.shippingTotal, o.ShippingTotal, o.shippingPrice)),
      status: mapOrderStatus(coalesce(o.orderStatus, o.status, o.Status)),
      customer_id: coalesce(o.customerId, o.CustomerId) != null ? String(coalesce(o.customerId, o.CustomerId)) : null,
      ordered_at,
    });
    const lines = coalesce(o.lines, o.Lines, o.orderLines, o.products) ?? [];
    for (const li of lines) {
      const lineId = toNum(coalesce(li.lineId, li.LineId, li.id));
      const sku = String(coalesce(li.sku, li.Sku) ?? "").trim();
      if (!lineId || !sku) continue;
      normalizedItems.push({
        external_line_item_id: lineId, external_order_id, sku,
        name: String(coalesce(li.productName, li.ProductName, li.name, sku)).trim(),
        quantity: toNum(coalesce(li.quantity, li.Quantity)),
        unit_price: toNum(coalesce(li.unitPrice, li.UnitPrice, li.price)),
        discount: toNum(coalesce(li.discount, li.Discount)),
        returned_quantity: 0, ordered_at,
      });
    }
  }
  return { orders: normalizedOrders, items: normalizedItems };
}

export function aggregateTsoftReturnedQuantities(returns: TsoftReturn[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of returns) {
    const lines = coalesce(r.lines, r.Lines) ?? [];
    for (const line of lines) {
      const id = toNum(coalesce(line.orderLineId, line.OrderLineId, line.lineId));
      const qty = toNum(coalesce(line.quantity, line.Quantity));
      if (!id || !qty) continue;
      map.set(id, (map.get(id) ?? 0) + qty);
    }
  }
  return map;
}

// ─── Credential extractor ─────────────────────────────────────────────────────

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
