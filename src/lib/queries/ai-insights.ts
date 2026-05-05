import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

type OrderRow = { amount: number; status: string; ordered_at: string };
type SpendRow = { platform: string; spend: number; date: string; campaign_name?: string | null };
type ExpenseRow = { category: string; amount: number; effective_date: string };
type ProductRow = {
  id: string;
  sku: string;
  name: string;
  cogs: number;
  stock_level: number;
  velocity: number;
  dnr: boolean;
  status: string;
};
type OrderItemRow = {
  sku: string;
  name: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  returned_quantity: number;
  ordered_at: string;
};

export type AiForecastPoint = {
  date: string;
  revenue: number | null;
  adSpend: number | null;
  netProfit: number | null;
  isForecast: boolean;
};

export type AiSuggestion = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger" | "success";
  impactTry?: number | null;
};

export type AiInventoryInsight = {
  sku: string;
  name: string;
  stockLevel: number;
  velocity: number;
  dir: number | null;
  dnr: boolean;
  kind: "critical" | "overstock" | "reorder" | "dnr";
  recommendedUnits: number | null;
};

export type AiInsightsResult = {
  basisDays: number;
  last: {
    revenue: number;
    adSpend: number;
    cogs: number;
    expenses: number;
    netProfit: number;
    roas: number | null;
    cos: number | null;
  };
  forecast: {
    next30Revenue: number;
    next30AdSpend: number;
    next30Cogs: number;
    next30Expenses: number;
    next30NetProfit: number;
    expectedRoas: number | null;
  };
  assumptions: {
    shippingCostPerOrder: number;
    marketplaceFeeRate: number;
  };
  series: AiForecastPoint[];
  suggestions: AiSuggestion[];
  inventory: AiInventoryInsight[];
  platformSpend: Array<{ platform: string; spend: number }>;
};

const isoDate = (d: Date) => toLocalISODate(d);

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

function enumerateDates(from: Date, toExclusive: Date) {
  const days: string[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toExclusive);
  end.setHours(0, 0, 0, 0);
  for (let d = start; d < end; d = addDays(d, 1)) days.push(isoDate(d));
  return days;
}

function movingAverage(values: number[], window: number) {
  const w = Math.max(1, Math.floor(window));
  if (values.length === 0) return 0;
  const slice = values.slice(Math.max(0, values.length - w));
  return sum(slice) / slice.length;
}

function buildCogsBySku(products: ProductRow[]) {
  const map = new Map<string, number>();
  for (const p of products) map.set(String(p.sku), Number(p.cogs ?? 0));
  return map;
}

function computeRevenueByDay(orders: OrderRow[], from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const map = new Map<string, number>();
  for (const o of orders) {
    if (o.ordered_at < fromIso || o.ordered_at >= toIso) continue;
    if (String(o.status) !== "odendi") continue;
    const d = toLocalISODate(new Date(String(o.ordered_at)));
    map.set(d, (map.get(d) ?? 0) + Number(o.amount ?? 0));
  }
  return map;
}

function computeSpendByDay(spends: SpendRow[], from: Date, to: Date) {
  const fromDate = isoDate(from);
  const toDate = isoDate(addDays(to, -1));
  const map = new Map<string, { total: number; byPlatform: Record<string, number> }>();
  for (const s of spends) {
    const d = String(s.date);
    if (d < fromDate || d > toDate) continue;
    const prev = map.get(d) ?? { total: 0, byPlatform: {} as Record<string, number> };
    const platform = String(s.platform ?? "bilinmiyor");
    const spend = Number(s.spend ?? 0);
    prev.total += spend;
    prev.byPlatform[platform] = (prev.byPlatform[platform] ?? 0) + spend;
    map.set(d, prev);
  }
  return map;
}

function computeExpensesByDay(expenses: ExpenseRow[], from: Date, to: Date) {
  const fromDate = isoDate(from);
  const toDate = isoDate(addDays(to, -1));
  const map = new Map<string, number>();
  for (const e of expenses) {
    const d = String(e.effective_date);
    if (d < fromDate || d > toDate) continue;
    map.set(d, (map.get(d) ?? 0) + Number(e.amount ?? 0));
  }
  return map;
}

function computeCogsByDay(items: OrderItemRow[], cogsBySku: Map<string, number>, from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const map = new Map<string, number>();
  for (const it of items) {
    if (it.ordered_at < fromIso || it.ordered_at >= toIso) continue;
    const d = toLocalISODate(new Date(String(it.ordered_at)));
    const cogs = Number(cogsBySku.get(String(it.sku)) ?? 0);
    const netUnits = Math.max(0, Number(it.quantity ?? 0) - Number(it.returned_quantity ?? 0));
    map.set(d, (map.get(d) ?? 0) + netUnits * cogs);
  }
  return map;
}

function buildPlatformSpend(spends: SpendRow[], from: Date, to: Date) {
  const byPlatform = new Map<string, number>();
  const fromDate = isoDate(from);
  const toDate = isoDate(addDays(to, -1));
  for (const s of spends) {
    const d = String(s.date);
    if (d < fromDate || d > toDate) continue;
    const key = String(s.platform ?? "bilinmiyor");
    byPlatform.set(key, (byPlatform.get(key) ?? 0) + Number(s.spend ?? 0));
  }
  return Array.from(byPlatform.entries())
    .map(([platform, spend]) => ({ platform, spend }))
    .sort((a, b) => b.spend - a.spend);
}

function computeInventoryInsights(products: ProductRow[]) {
  const insights: AiInventoryInsight[] = [];

  for (const p of products) {
    const stock = Number(p.stock_level ?? 0);
    const velocity = Number(p.velocity ?? 0);
    const dir = stock <= 0 ? 0 : velocity <= 0 ? null : stock / velocity;

    const critical = stock <= 0 || (dir != null && dir <= 7);
    const overstock = dir != null && dir >= 90;
    const reorder = !p.dnr && dir != null && dir > 7 && dir < 30;

    const base: Omit<AiInventoryInsight, "kind" | "recommendedUnits"> = {
      sku: String(p.sku),
      name: String(p.name),
      stockLevel: stock,
      velocity,
      dir,
      dnr: Boolean(p.dnr),
    };

    if (p.dnr) { insights.push({ ...base, kind: "dnr", recommendedUnits: null }); continue; }
    if (critical) { insights.push({ ...base, kind: "critical", recommendedUnits: velocity > 0 ? Math.max(0, Math.ceil(velocity * 14 - stock)) : null }); continue; }
    if (reorder) { insights.push({ ...base, kind: "reorder", recommendedUnits: velocity > 0 ? Math.max(0, Math.ceil(velocity * 30 - stock)) : null }); continue; }
    if (overstock) { insights.push({ ...base, kind: "overstock", recommendedUnits: null }); continue; }
  }

  const order: Record<AiInventoryInsight["kind"], number> = { critical: 0, reorder: 1, overstock: 2, dnr: 3 };
  return insights.sort((a, b) => order[a.kind] - order[b.kind]);
}

function buildSuggestions(args: {
  basisDays: number;
  roas: number | null;
  cos: number | null;
  platformSpend: Array<{ platform: string; spend: number }>;
  products: ProductRow[];
  items: OrderItemRow[];
  cogsBySku: Map<string, number>;
  from: Date;
  to: Date;
}) {
  const suggestions: AiSuggestion[] = [];

  if (args.basisDays < 14) {
    suggestions.push({ id: "basis-short", title: "Kısa dönem verisi", detail: "Seçili tarih aralığı 14 günden kısa. Tahminler daha dalgalı olabilir; L30 seçerek daha stabil sonuç alırsınız.", severity: "info", impactTry: null });
  }

  const totalSpend = sum(args.platformSpend.map((p) => p.spend));
  const topPlatform = args.platformSpend[0];
  if (topPlatform && totalSpend > 0) {
    const pct = topPlatform.spend / totalSpend;
    if (pct >= 0.65) {
      suggestions.push({ id: "spend-concentration", title: "Harcama tek platformda yoğun", detail: `${topPlatform.platform} toplam harcamanın ${Math.round(pct * 100)}%'ini oluşturuyor. Ölçeklemeden önce alternatif kanal test planı oluşturun.`, severity: "warning", impactTry: null });
    }
  }

  if (args.roas != null && args.roas < 1.6) {
    suggestions.push({ id: "low-roas", title: "ROAS düşük görünüyor", detail: "Kreatif/segment testleri yapın, düşük performanslı kampanyaları kısın ve bütçeyi kârlı SKU'lara kaydırın.", severity: "warning", impactTry: null });
  }
  if (args.cos != null && args.cos > 0.2) {
    suggestions.push({ id: "high-cos", title: "COS yüksek", detail: "Harcama/ciro oranı yüksek. Hedef ROAS'a göre bütçe limitleri ve daha sık kreatif yenileme önerilir.", severity: "warning", impactTry: null });
  }

  const fromIso = args.from.toISOString();
  const toIso = args.to.toISOString();
  const bySku = new Map<string, { units: number; revenue: number; returnsUnits: number; name: string }>();
  for (const it of args.items) {
    if (it.ordered_at < fromIso || it.ordered_at >= toIso) continue;
    const sku = String(it.sku);
    const row = bySku.get(sku) ?? ({ units: 0, revenue: 0, returnsUnits: 0, name: String(it.name ?? sku) } satisfies { units: number; revenue: number; returnsUnits: number; name: string });
    const qty = Number(it.quantity ?? 0);
    const returned = Number(it.returned_quantity ?? 0);
    row.units += Math.max(0, qty - returned);
    row.returnsUnits += Math.max(0, returned);
    row.revenue += qty * Number(it.unit_price ?? 0) - Number(it.discount ?? 0);
    bySku.set(sku, row);
  }

  const scored = Array.from(bySku.entries())
    .map(([sku, v]) => {
      const cogs = Number(args.cogsBySku.get(sku) ?? 0);
      const profit = v.revenue - v.units * cogs;
      const unitRevenue = safeDivide(v.revenue, Math.max(1, v.units)) ?? 0;
      const unitProfit = unitRevenue - cogs;
      const returnRate = safeDivide(v.returnsUnits, Math.max(1, v.units + v.returnsUnits));
      return { sku, name: v.name, profit, unitProfit, returnRate, revenue: v.revenue, units: v.units };
    })
    .filter((x) => x.units >= 5)
    .sort((a, b) => a.profit - b.profit);

  const worst = scored[0];
  if (worst && worst.profit < 0) {
    const suggested = Math.max(1, Math.round(Math.abs(worst.unitProfit) * 1.2));
    suggestions.push({ id: "loss-product", title: "Kârsız ürün tespit edildi", detail: `${worst.name} (${worst.sku}) seçili aralıkta zarar ediyor. Birim kârı pozitife taşımak için fiyatı ~${suggested}₺ artırmayı veya COGS'i güncellemeyi değerlendirin.`, severity: "danger", impactTry: null });
  }

  const highReturn = scored.filter((x) => (x.returnRate ?? 0) >= 0.12).sort((a, b) => (b.returnRate ?? 0) - (a.returnRate ?? 0))[0];
  if (highReturn) {
    suggestions.push({ id: "high-returns", title: "İade oranı yüksek SKU", detail: `${highReturn.name} (${highReturn.sku}) için iade oranı yüksek. Ürün sayfası (ölçü/kalite), kargo/hasar ve beklenti uyumu kontrolü önerilir.`, severity: "warning", impactTry: null });
  }

  if (suggestions.length === 0) {
    suggestions.push({ id: "stable", title: "Genel durum stabil", detail: "Belirgin bir risk sinyali görülmüyor. Kazanan kampanyaları kontrollü ölçekleyip COGS ve iadeleri yakından takip edin.", severity: "success", impactTry: null });
  }

  return suggestions.slice(0, 8);
}

export async function fetchAiInsights(params: {
  storeId: string;
  from: Date;
  to: Date;
  shippingCostPerOrder?: number;
  marketplaceFeeRate?: number;
}): Promise<AiInsightsResult> {
  const { storeId, from, to } = params;
  const shippingCostPerOrder = Number(params.shippingCostPerOrder ?? 0);
  const marketplaceFeeRate = Number(params.marketplaceFeeRate ?? 0);

  const rangeDays = enumerateDates(from, to);
  const basisDays = Math.max(1, Math.min(30, rangeDays.length));
  const basisFrom = addDays(to, -basisDays);

  const supabase = getSupabaseClient();

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("amount,status,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", basisFrom.toISOString())
    .lt("ordered_at", to.toISOString());
  if (ordersError) throw ordersError;

  const orders: OrderRow[] = (ordersData ?? []).map((row) => {
    const r = asRecord(row);
    return { amount: Number(r.amount ?? 0), status: String(r.status ?? ""), ordered_at: String(r.ordered_at ?? "") };
  });

  const { data: spendData, error: spendError } = await supabase
    .from("marketing_spend")
    .select("platform,spend,date,campaign_name")
    .eq("store_id", storeId)
    .gte("date", isoDate(basisFrom))
    .lte("date", isoDate(addDays(to, -1)));
  if (spendError) throw spendError;

  const spends: SpendRow[] = (spendData ?? []).map((row) => {
    const r = asRecord(row);
    return { platform: String(r.platform ?? "bilinmiyor"), spend: Number(r.spend ?? 0), date: String(r.date ?? ""), campaign_name: (r.campaign_name as string | null | undefined) ?? null };
  });

  const { data: expenseData, error: expenseError } = await supabase
    .from("expenses")
    .select("category,amount,effective_date")
    .eq("store_id", storeId)
    .gte("effective_date", isoDate(basisFrom))
    .lte("effective_date", isoDate(addDays(to, -1)));
  if (expenseError) throw expenseError;

  const expenses: ExpenseRow[] = (expenseData ?? []).map((row) => {
    const r = asRecord(row);
    return { category: String(r.category ?? ""), amount: Number(r.amount ?? 0), effective_date: String(r.effective_date ?? "") };
  });

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id,sku,name,cogs,stock_level,velocity,status,dnr")
    .eq("store_id", storeId);
  if (productsError) throw productsError;
  const products: ProductRow[] = (productsData ?? []).map((row) => {
    const r = asRecord(row);
    return { id: String(r.id ?? ""), sku: String(r.sku ?? ""), name: String(r.name ?? ""), cogs: Number(r.cogs ?? 0), stock_level: Number(r.stock_level ?? 0), velocity: Number(r.velocity ?? 0), status: String(r.status ?? "aktif"), dnr: Boolean(r.dnr ?? false) };
  });

  const { data: itemsData, error: itemsError } = await supabase
    .from("order_items")
    .select("sku,name,quantity,unit_price,discount,returned_quantity,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", basisFrom.toISOString())
    .lt("ordered_at", to.toISOString());
  if (itemsError) throw itemsError;

  const items: OrderItemRow[] = (itemsData ?? []).map((row) => {
    const r = asRecord(row);
    return { sku: String(r.sku ?? ""), name: (r.name as string | null | undefined) ?? null, quantity: Number(r.quantity ?? 0), unit_price: Number(r.unit_price ?? 0), discount: Number(r.discount ?? 0), returned_quantity: Number(r.returned_quantity ?? 0), ordered_at: String(r.ordered_at ?? "") };
  });

  const cogsBySku = buildCogsBySku(products);
  const revenueByDay = computeRevenueByDay(orders, basisFrom, to);
  const txByDay = new Map<string, number>();
  for (const o of orders) {
    if (String(o.status) !== "odendi") continue;
    if (o.ordered_at < basisFrom.toISOString() || o.ordered_at >= to.toISOString()) continue;
    const d = toLocalISODate(new Date(String(o.ordered_at)));
    txByDay.set(d, (txByDay.get(d) ?? 0) + 1);
  }
  const spendByDay = computeSpendByDay(spends, basisFrom, to);
  const expenseByDay = computeExpensesByDay(expenses, basisFrom, to);
  const cogsByDay = computeCogsByDay(items, cogsBySku, basisFrom, to);

  const basisDates = enumerateDates(basisFrom, to);
  const revenueSeries = basisDates.map((d) => revenueByDay.get(d) ?? 0);
  const spendSeries = basisDates.map((d) => spendByDay.get(d)?.total ?? 0);
  const cogsSeries = basisDates.map((d) => cogsByDay.get(d) ?? 0);
  const expenseSeries = basisDates.map((d) => expenseByDay.get(d) ?? 0);
  const shippingSeries = basisDates.map((d) => (txByDay.get(d) ?? 0) * shippingCostPerOrder);
  const feeSeries = basisDates.map((d) => (revenueByDay.get(d) ?? 0) * marketplaceFeeRate);

  const avgRevenue = movingAverage(revenueSeries, Math.min(14, basisDays));
  const avgSpend = movingAverage(spendSeries, Math.min(14, basisDays));
  const avgCogs = movingAverage(cogsSeries, Math.min(14, basisDays));
  const avgExpense = movingAverage(expenseSeries, Math.min(14, basisDays));
  const avgShipping = movingAverage(shippingSeries, Math.min(14, basisDays));
  const avgFees = movingAverage(feeSeries, Math.min(14, basisDays));

  const lastRevenue = sum(revenueSeries);
  const lastAdSpend = sum(spendSeries);
  const lastCogs = sum(cogsSeries);
  const lastExpenses = sum(expenseSeries);
  const lastShipping = sum(shippingSeries);
  const lastFees = sum(feeSeries);
  const lastNetProfit = lastRevenue - (lastAdSpend + lastCogs + lastExpenses + lastShipping + lastFees);
  const lastRoas = safeDivide(lastRevenue, lastAdSpend);
  const lastCos = safeDivide(lastAdSpend, lastRevenue);

  const next30Revenue = Math.round(avgRevenue * 30);
  const next30AdSpend = Math.round(avgSpend * 30);
  const next30Cogs = Math.round(avgCogs * 30);
  const next30Expenses = Math.round(avgExpense * 30);
  const next30Shipping = Math.round(avgShipping * 30);
  const next30Fees = Math.round(avgFees * 30);
  const next30NetProfit = next30Revenue - (next30AdSpend + next30Cogs + next30Expenses + next30Shipping + next30Fees);
  const expectedRoas = safeDivide(next30Revenue, next30AdSpend);

  const actualSeries: AiForecastPoint[] = basisDates.map((d) => {
    const revenue = revenueByDay.get(d) ?? 0;
    const adSpend = spendByDay.get(d)?.total ?? 0;
    const cogs = cogsByDay.get(d) ?? 0;
    const exp = expenseByDay.get(d) ?? 0;
    const shipping = (txByDay.get(d) ?? 0) * shippingCostPerOrder;
    const fees = revenue * marketplaceFeeRate;
    const netProfit = revenue - (adSpend + cogs + exp + shipping + fees);
    return { date: d, revenue, adSpend, netProfit, isForecast: false };
  });

  const forecastFrom = new Date(to);
  forecastFrom.setHours(0, 0, 0, 0);
  const forecastTo = addDays(forecastFrom, 30);
  const forecastDates = enumerateDates(forecastFrom, forecastTo);
  const forecastSeries: AiForecastPoint[] = forecastDates.map((d) => ({
    date: d,
    revenue: Math.round(avgRevenue),
    adSpend: Math.round(avgSpend),
    netProfit: Math.round(avgRevenue - (avgSpend + avgCogs + avgExpense + avgShipping + avgFees)),
    isForecast: true,
  }));

  const platformSpend = buildPlatformSpend(spends, basisFrom, to);
  const suggestions = buildSuggestions({ basisDays, roas: lastRoas, cos: lastCos, platformSpend, products, items, cogsBySku, from: basisFrom, to });
  const inventory = computeInventoryInsights(products);

  return {
    basisDays,
    last: { revenue: lastRevenue, adSpend: lastAdSpend, cogs: lastCogs, expenses: lastExpenses, netProfit: lastNetProfit, roas: lastRoas, cos: lastCos },
    forecast: { next30Revenue, next30AdSpend, next30Cogs, next30Expenses, next30NetProfit, expectedRoas },
    assumptions: { shippingCostPerOrder, marketplaceFeeRate },
    series: [...actualSeries, ...forecastSeries],
    suggestions,
    inventory,
    platformSpend,
  };
}
