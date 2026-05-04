export type TsoftCredentials = {
  baseUrl: string;
  apiUser: string;
  apiPass: string;
};

// ─── Token cache (server-side in-memory, per base+user) ──────────────────────

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAuthToken(creds: TsoftCredentials): Promise<string> {
  const cacheKey = `${creds.baseUrl}::${creds.apiUser}`;
  const cached = tokenCache.get(cacheKey);
  // Refresh 60s before expiry
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const base = normalizeBaseUrl(creds.baseUrl);
  const url = `${base}/rest1/auth/login/${encodeURIComponent(creds.apiUser)}`;
  const body = new URLSearchParams({ user: creds.apiUser, pass: creds.apiPass });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  let json: { success?: boolean; message?: string; data?: Array<{ token?: string }> };
  try { json = JSON.parse(text); } catch { throw new Error(`Tsoft login hata: ${res.status} ${text.slice(0, 200)}`); }

  if (!json.success || !json.data?.[0]?.token) {
    throw new Error(`Tsoft login başarısız: ${json.message ?? text.slice(0, 200)}`);
  }

  const token = json.data[0].token;
  // Cache for 55 minutes (token valid 1 hour)
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

// ─── HTTP helper (form-encoded POST) ─────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
  return s.replace(/\/$/, "");
}

async function tsoftPost<T>(
  creds: TsoftCredentials,
  path: string,
  params: Record<string, string>
): Promise<T> {
  const token = await getAuthToken(creds);
  const base = normalizeBaseUrl(creds.baseUrl);
  const url = `${base}${path}`;
  const body = new URLSearchParams({ token, ...params });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Tsoft API hata: ${res.status} (${path}) ${text.slice(0, 200)}`);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Tsoft API yanıt parse hatası (${path}): ${text.slice(0, 200)}`);
  }
}

// ─── Raw types ────────────────────────────────────────────────────────────────

type TsoftApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T[];
  totalCount?: number;
  TotalCount?: number;
};

type TsoftProductVariant = {
  productCode?: string; ProductCode?: string;
  barcode?: string; Barcode?: string;
  stockAmount?: number | string; StockAmount?: number | string; stock?: number | string;
  status?: number | string | boolean; Status?: number | string | boolean;
  isActive?: boolean;
};

type TsoftRawProduct = {
  productCode?: string; ProductCode?: string;
  productName?: string; ProductName?: string; name?: string; Name?: string; title?: string; Title?: string;
  barcode?: string; Barcode?: string;
  stockAmount?: number | string; StockAmount?: number | string; stock?: number | string; Stock?: number | string;
  status?: number | string | boolean; Status?: number | string | boolean; isActive?: boolean;
  variants?: TsoftProductVariant[]; Variants?: TsoftProductVariant[];
  productVariants?: TsoftProductVariant[];
};

type TsoftOrderProduct = {
  productCode?: string; ProductCode?: string;
  productName?: string; ProductName?: string; name?: string;
  barcode?: string; Barcode?: string;
  quantity?: number | string; Quantity?: number | string; amount?: number | string;
  unitPrice?: number | string; UnitPrice?: number | string; price?: number | string; Price?: number | string;
  discount?: number | string; Discount?: number | string; discountAmount?: number | string;
  lineId?: number | string; LineId?: number | string; id?: number | string;
};

type TsoftRawOrder = {
  orderId?: number | string; OrderId?: number | string; orderCode?: string; OrderCode?: string; id?: number | string;
  orderDate?: string; OrderDate?: string; createdDate?: string; CreatedDate?: string; insertDate?: string;
  status?: string | number; Status?: string | number; orderStatus?: string; OrderStatus?: string;
  totalAmount?: number | string; TotalAmount?: number | string; totalPrice?: number | string;
  taxAmount?: number | string; TaxAmount?: number | string; tax?: number | string;
  shippingAmount?: number | string; ShippingAmount?: number | string; shippingPrice?: number | string; cargoPrice?: number | string;
  customerId?: number | string; CustomerId?: number | string; memberCode?: string;
  products?: TsoftOrderProduct[]; Products?: TsoftOrderProduct[];
  orderProducts?: TsoftOrderProduct[]; items?: TsoftOrderProduct[];
};

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchAllTsoftProducts(creds: TsoftCredentials): Promise<TsoftRawProduct[]> {
  const allProducts: TsoftRawProduct[] = [];
  const limit = 500;
  let start = 0;

  for (let i = 0; i < 200; i++) {
    const json = await tsoftPost<TsoftApiResponse<TsoftRawProduct>>(creds, "/rest1/product/get", {
      start: String(start),
      limit: String(limit),
      FetchDetails: "true",
      StockFields: "true",
    });

    const batch = json.data ?? [];
    if (batch.length === 0) break;
    allProducts.push(...batch);
    if (batch.length < limit) break;
    start += limit;
  }

  return allProducts;
}

export type NormalizedProduct = { sku: string; name: string; stock_level: number; status: "aktif" | "pasif" };

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function coalesce<T>(...args: (T | undefined | null)[]): T | undefined {
  for (const a of args) if (a != null) return a;
  return undefined;
}

function isVariantActive(v: TsoftProductVariant): boolean {
  const s = coalesce(v.status, v.Status);
  if (v.isActive != null) return Boolean(v.isActive);
  if (s == null) return true;
  return String(s) === "1" || String(s).toLowerCase() === "true" || String(s).toLowerCase() === "aktif";
}

function isProductActive(p: TsoftRawProduct): boolean {
  if (p.isActive != null) return Boolean(p.isActive);
  const s = coalesce(p.status, p.Status);
  if (s == null) return true;
  return String(s) === "1" || String(s).toLowerCase() === "true" || String(s).toLowerCase() === "aktif";
}

export function normalizeTsoftProducts(products: TsoftRawProduct[]): NormalizedProduct[] {
  const rows: NormalizedProduct[] = [];

  for (const p of products) {
    const name = String(coalesce(p.productName, p.ProductName, p.name, p.Name, p.title, p.Title) ?? "").trim();
    const baseSku = String(coalesce(p.productCode, p.ProductCode, p.barcode, p.Barcode) ?? "").trim();
    const baseStock = toNum(coalesce(p.stockAmount, p.StockAmount, p.stock, p.Stock));
    const baseActive = isProductActive(p);
    const variants = coalesce(p.variants, p.Variants, p.productVariants) ?? [];

    if (variants.length > 0) {
      for (const v of variants) {
        const sku = String(coalesce(v.productCode, v.ProductCode, v.barcode, v.Barcode) ?? "").trim();
        if (!sku) continue;
        rows.push({
          sku,
          name,
          stock_level: toNum(coalesce(v.stockAmount, v.StockAmount, v.stock)),
          status: isVariantActive(v) ? "aktif" : "pasif",
        });
      }
    } else {
      if (!baseSku) continue;
      rows.push({ sku: baseSku, name, stock_level: baseStock, status: baseActive ? "aktif" : "pasif" });
    }
  }

  return rows;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

function formatDateTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export async function fetchAllTsoftOrders(creds: TsoftCredentials): Promise<TsoftRawOrder[]> {
  const allOrders: TsoftRawOrder[] = [];
  const limit = 200;
  let start = 0;

  // Fetch last 2 years of orders
  const dateEnd = new Date();
  const dateStart = new Date(dateEnd);
  dateStart.setFullYear(dateStart.getFullYear() - 2);

  for (let i = 0; i < 500; i++) {
    const json = await tsoftPost<TsoftApiResponse<TsoftRawOrder>>(creds, "/rest1/order/get", {
      OrderDateTimeStart: formatDateTime(dateStart),
      OrderDateTimeEnd: formatDateTime(dateEnd),
      FetchProductData: "true",
      start: String(start),
      limit: String(limit),
    });

    const batch = json.data ?? [];
    if (batch.length === 0) break;
    allOrders.push(...batch);
    if (batch.length < limit) break;
    start += limit;
  }

  return allOrders;
}

export type NormalizedOrder = {
  external_order_id: number;
  amount: number; tax: number; shipping: number;
  status: "odendi" | "iade" | "iptal" | "beklemede";
  customer_id: string | null;
  ordered_at: string;
};

export type NormalizedOrderItem = {
  external_line_item_id: number; external_order_id: number;
  sku: string; name: string;
  quantity: number; unit_price: number; discount: number;
  returned_quantity: number; ordered_at: string;
};

function mapOrderStatus(raw: unknown): NormalizedOrder["status"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("iptal") || s.includes("cancel")) return "iptal";
  if (s.includes("iade") || s.includes("refund") || s.includes("return")) return "iade";
  if (s.includes("odendi") || s.includes("paid") || s.includes("complet") || s.includes("teslim") || s.includes("deliver")) return "odendi";
  return "beklemede";
}

export function normalizeTsoftOrders(orders: TsoftRawOrder[]) {
  const normalizedOrders: NormalizedOrder[] = [];
  const normalizedItems: NormalizedOrderItem[] = [];

  for (const o of orders) {
    const rawId = coalesce(o.orderId, o.OrderId, o.id);
    const codeId = o.orderCode ?? o.OrderCode;
    // Use numeric id if available, else hash of code
    const external_order_id = rawId ? toNum(rawId) : (codeId ? Math.abs(hashCode(codeId)) : 0);
    if (!external_order_id) continue;

    const rawDate = coalesce(o.orderDate, o.OrderDate, o.createdDate, o.CreatedDate, o.insertDate);
    const ordered_at = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();

    normalizedOrders.push({
      external_order_id,
      amount: toNum(coalesce(o.totalAmount, o.TotalAmount, o.totalPrice)),
      tax: toNum(coalesce(o.taxAmount, o.TaxAmount, o.tax)),
      shipping: toNum(coalesce(o.shippingAmount, o.ShippingAmount, o.shippingPrice, o.cargoPrice)),
      status: mapOrderStatus(coalesce(o.orderStatus, o.OrderStatus, o.status, o.Status)),
      customer_id: coalesce(o.customerId, o.CustomerId, o.memberCode) != null
        ? String(coalesce(o.customerId, o.CustomerId, o.memberCode))
        : null,
      ordered_at,
    });

    const lines = coalesce(o.products, o.Products, o.orderProducts, o.items) ?? [];
    for (let idx = 0; idx < lines.length; idx++) {
      const li = lines[idx]!;
      const sku = String(coalesce(li.productCode, li.ProductCode, li.barcode, li.Barcode) ?? "").trim();
      if (!sku) continue;

      const rawLineId = coalesce(li.lineId, li.LineId, li.id);
      // Synthesize a stable line item id from order_id + idx if none present
      const external_line_item_id = rawLineId ? toNum(rawLineId) : external_order_id * 10000 + idx;

      normalizedItems.push({
        external_line_item_id,
        external_order_id,
        sku,
        name: String(coalesce(li.productName, li.ProductName, li.name, sku)).trim(),
        quantity: toNum(coalesce(li.quantity, li.Quantity, li.amount)),
        unit_price: toNum(coalesce(li.unitPrice, li.UnitPrice, li.price, li.Price)),
        discount: toNum(coalesce(li.discount, li.Discount, li.discountAmount)),
        returned_quantity: 0,
        ordered_at,
      });
    }
  }

  return { orders: normalizedOrders, items: normalizedItems };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ─── Returns (Tsoft doesn't have a dedicated return list endpoint in rest1) ───
// Returns are reflected via order status "iade" — no separate sync needed.

export async function fetchAllTsoftReturns(_creds: TsoftCredentials) {
  return [];
}

export function aggregateTsoftReturnedQuantities(_returns: unknown[]) {
  return new Map<number, number>();
}

// ─── Credential extractor ─────────────────────────────────────────────────────

export function getTsoftCreds(apiKeys: unknown): TsoftCredentials | null {
  if (!apiKeys || typeof apiKeys !== "object") return null;
  const any = apiKeys as Record<string, unknown>;
  const nested = any["tsoft"];
  const src = nested && typeof nested === "object" ? (nested as Record<string, unknown>) : any;

  const baseUrl = typeof src.base_url === "string" ? src.base_url.trim() : "";
  // Support both new (api_user/api_pass) and legacy (api_key/api_secret) field names
  const apiUser = String(coalesce(src.api_user, src.api_key) ?? "").trim();
  const apiPass = String(coalesce(src.api_pass, src.api_secret) ?? "").trim();

  if (!baseUrl || !apiUser || !apiPass) return null;
  return { baseUrl, apiUser, apiPass };
}
