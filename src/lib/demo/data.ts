export type DemoStore = {
  id: string;
  name: string;
  platform: string;
  api_keys?: Record<string, unknown>;
};
export type DemoProduct = {
  id: string;
  store_id: string;
  sku: string;
  name: string;
  cogs: number;
  stock_level: number;
  velocity: number;
  status: string;
  dnr: boolean;
};

export type DemoOrder = {
  id: string;
  store_id: string;
  customer_id: string;
  channel: "web" | "trendyol" | "hepsiburada" | "amazon";
  amount: number;
  tax: number;
  shipping: number;
  status: "odendi" | "iade" | "iptal" | "beklemede";
  ordered_at: string;
};

export type DemoOrderItem = {
  id: string;
  store_id: string;
  order_id: string;
  external_line_item_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  returned_quantity: number;
  ordered_at: string;
};

export type DemoSpend = {
  id: string;
  store_id: string;
  platform: string;
  spend: number;
  date: string; // YYYY-MM-DD
  campaign_name: string;
};

export type DemoExpense = {
  id: string;
  store_id: string;
  category: string;
  amount: number;
  effective_date: string; // YYYY-MM-DD
  recurring_status?: boolean;
};

import { toLocalISODate } from "@/lib/date";

const now = new Date();
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => toLocalISODate(d);
const addDays = (base: Date, days: number) => {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)]!;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export const demoStores: DemoStore[] = [
  { id: "demo-store-1", name: "Demo Mağaza", platform: "shopify", api_keys: {} },
  { id: "demo-store-2", name: "EU Demo", platform: "manual", api_keys: {} },
];

export const demoProducts: DemoProduct[] = [
  {
    id: "p1",
    store_id: "demo-store-1",
    sku: "NP-TEE-BLK-M",
    name: "NetProfit Tee (Siyah) - M",
    cogs: 120,
    stock_level: 120,
    velocity: 3.6,
    status: "aktif",
    dnr: false,
  },
  {
    id: "p2",
    store_id: "demo-store-1",
    sku: "NP-MUG-WHT",
    name: "NetProfit Kupa (Beyaz)",
    cogs: 45,
    stock_level: 18,
    velocity: 2.2,
    status: "aktif",
    dnr: false,
  },
  {
    id: "p3",
    store_id: "demo-store-1",
    sku: "NP-HOODIE-GRY-L",
    name: "NetProfit Hoodie (Gri) - L",
    cogs: 260,
    stock_level: 240,
    velocity: 0.7,
    status: "aktif",
    dnr: true,
  },
];

// 60 günlük deterministik demo verisi üret (charts/tablo dolu olsun).
const rng = mulberry32(1337);
const storeId = "demo-store-1";
const start = new Date(now);
start.setHours(0, 0, 0, 0);
start.setDate(start.getDate() - 59);

const platforms = ["Meta Ads", "Google Ads", "TikTok Ads", "Pinterest Ads"] as const;
const campaigns = {
  "Meta Ads": ["Prospecting - ABO", "Retargeting - CBO"],
  "Google Ads": ["Brand Search", "Shopping - PMax"],
  "TikTok Ads": ["Spark Ads", "Broad - Creative Test"],
  "Pinterest Ads": ["Prospecting - Interests", "Retargeting - Catalog"],
} as const;

const priceBySku: Record<string, number> = {
  "NP-TEE-BLK-M": 349,
  "NP-MUG-WHT": 149,
  "NP-HOODIE-GRY-L": 799,
};

const demoOrdersGenerated: DemoOrder[] = [];
const demoOrderItemsGenerated: DemoOrderItem[] = [];
const demoSpendsGenerated: DemoSpend[] = [];
const demoExpensesGenerated: DemoExpense[] = [];

// Demo müşteriler (cohort/retention için)
const customerPool: string[] = [];
let customerSeq = 1;
function nextCustomerId() {
  const id = `c${customerSeq++}`;
  customerPool.push(id);
  return id;
}
function pickCustomerId() {
  // %72 yeni, %28 geri dönen (varsa)
  if (customerPool.length === 0) return nextCustomerId();
  const returning = rng() < 0.28;
  return returning ? pick(rng, customerPool) : nextCustomerId();
}

let orderSeq = 1;
let itemSeq = 1;
let spendSeq = 1;
let externalLineItemSeq = 10_000;

for (let day = 0; day < 60; day += 1) {
  const d = addDays(start, day);
  const dow = d.getDay(); // 0 Sun
  const weekdayFactor = dow === 0 || dow === 6 ? 0.85 : 1.0;
  const season = 1 + Math.sin((day / 60) * Math.PI * 2) * 0.12;

  // Spend per platform
  for (const p of platforms) {
    const base =
      p === "Meta Ads"
        ? 140
        : p === "Google Ads"
          ? 90
          : p === "Pinterest Ads"
            ? 45
            : 55;
    const jitter = (rng() - 0.5) * 30;
    const spend = clamp((base + jitter) * weekdayFactor * season, 10, 320);
    demoSpendsGenerated.push({
      id: `s${spendSeq++}`,
      store_id: storeId,
      platform: p,
      spend: Math.round(spend),
      date: isoDate(d),
      campaign_name: pick(rng, [...campaigns[p]]),
    });
  }

  // Orders (3-9 per day)
  const ordersToday = Math.floor(3 + rng() * 7);
  for (let j = 0; j < ordersToday; j += 1) {
    const statusRoll = rng();
    const status: DemoOrder["status"] =
      statusRoll < 0.88 ? "odendi" : statusRoll < 0.94 ? "beklemede" : "iade";

    const orderId = `o${orderSeq++}`;
    const customerId = pickCustomerId();
    const channelRoll = rng();
    const channel: DemoOrder["channel"] =
      channelRoll < 0.55
        ? "web"
        : channelRoll < 0.8
          ? "trendyol"
          : channelRoll < 0.92
            ? "hepsiburada"
            : "amazon";
    // 1-3 items
    const itemsCount = 1 + Math.floor(rng() * 3);
    let orderRevenue = 0;
    for (let k = 0; k < itemsCount; k += 1) {
      const sku = pick(rng, demoProducts).sku;
      const unitPrice = priceBySku[sku] ?? Math.round(100 + rng() * 500);
      const quantity = 1 + Math.floor(rng() * 3);
      const discount = rng() < 0.25 ? Math.round(rng() * 60) : 0;
      const returned = status === "iade" ? clamp(Math.floor(rng() * quantity), 0, quantity) : 0;
      orderRevenue += quantity * unitPrice - discount;
      demoOrderItemsGenerated.push({
        id: `oi${itemSeq++}`,
        store_id: storeId,
        order_id: orderId,
        external_line_item_id: externalLineItemSeq++,
        sku,
        name: demoProducts.find((p) => p.sku === sku)?.name ?? sku,
        quantity,
        unit_price: unitPrice,
        discount,
        returned_quantity: returned,
        ordered_at: iso(d),
      });
    }

    demoOrdersGenerated.push({
      id: orderId,
      store_id: storeId,
      customer_id: customerId,
      channel,
      amount: Math.round(orderRevenue),
      tax: 0,
      shipping: 0,
      status,
      ordered_at: iso(d),
    });
  }

  // Expenses: ~weekly
  if (day % 7 === 2) {
    const expenseCats = ["Kira", "Personel", "SaaS", "Depo", "Muhasebe"] as const;
    const amount = Math.round(280 + rng() * 420);
    demoExpensesGenerated.push({
      id: `e${day}`,
      store_id: storeId,
      category: pick(rng, [...expenseCats]),
      amount,
      effective_date: isoDate(d),
      recurring_status: false,
    });
  }

  // Monthly recurring baseline (only once per generated window)
  if (day === 0) {
    demoExpensesGenerated.push({
      id: "e-rent",
      store_id: storeId,
      category: "Kira",
      amount: 18500,
      effective_date: isoDate(d),
      recurring_status: true,
    });
    demoExpensesGenerated.push({
      id: "e-salary",
      store_id: storeId,
      category: "Personel",
      amount: 42000,
      effective_date: isoDate(d),
      recurring_status: true,
    });
  }
}

export const demoOrders: DemoOrder[] = demoOrdersGenerated;
export const demoOrderItems: DemoOrderItem[] = demoOrderItemsGenerated;
export const demoSpends: DemoSpend[] = demoSpendsGenerated;
export const demoExpenses: DemoExpense[] = demoExpensesGenerated;
