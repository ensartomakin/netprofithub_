import { isDemoMode } from "@/lib/demo/mode";
import { getSupabaseClient } from "@/lib/supabase/client";
import { demoOrderItems, demoProducts } from "@/lib/demo/data";
import { toLocalISODate } from "@/lib/date";

export type ReturnSummary = {
  returnedUnits: number;
  returnRate: number | null; // returned / (returned + net)
  returnedRevenue: number;
  estimatedProfitImpact: number; // MVP: -returnedRevenue (COGS netted out by netUnits)
};

export type ReturnSkuRow = {
  sku: string;
  name: string;
  returnedUnits: number;
  returnRate: number | null;
  returnedRevenue: number;
};

export type ReturnPoint = {
  date: string; // YYYY-MM-DD
  returnedUnits: number;
  returnedRevenue: number;
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

function isoDate(d: Date) {
  return toLocalISODate(d);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function enumerateDates(from: Date, to: Date) {
  const days: string[] = [];
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  for (let d = start; d < end; d = addDays(d, 1)) days.push(isoDate(d));
  return days;
}

function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

function estimateReturnedRevenue(it: OrderItemRow) {
  const qty = Number(it.quantity ?? 0);
  const returned = Math.max(0, Number(it.returned_quantity ?? 0));
  if (qty <= 0 || returned <= 0) return 0;
  const gross = returned * Number(it.unit_price ?? 0);
  const discountShare = Number(it.discount ?? 0) * (returned / qty);
  return gross - discountShare;
}

function buildNameBySku(storeId: string) {
  const map = new Map<string, string>();
  for (const p of demoProducts) {
    if (p.store_id !== storeId) continue;
    map.set(p.sku, p.name);
  }
  return map;
}

async function fetchItems(params: { storeId: string; from: Date; to: Date }) {
  const { storeId, from, to } = params;
  if (isDemoMode()) {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    return demoOrderItems
      .filter((x) => x.store_id === storeId)
      .filter((x) => x.ordered_at >= fromIso && x.ordered_at < toIso)
      .map((x) => ({
        sku: x.sku,
        name: x.name,
        quantity: x.quantity,
        unit_price: x.unit_price,
        discount: x.discount,
        returned_quantity: x.returned_quantity,
        ordered_at: x.ordered_at,
      })) as OrderItemRow[];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("sku,name,quantity,unit_price,discount,returned_quantity,ordered_at")
    .eq("store_id", storeId)
    .gte("ordered_at", from.toISOString())
    .lt("ordered_at", to.toISOString());
  if (error) throw error;
  return (data ?? []).map((row) => row as unknown as Record<string, unknown>).map((r) => ({
    sku: String(r.sku ?? ""),
    name: (r.name as string | null | undefined) ?? null,
    quantity: Number(r.quantity ?? 0),
    unit_price: Number(r.unit_price ?? 0),
    discount: Number(r.discount ?? 0),
    returned_quantity: Number(r.returned_quantity ?? 0),
    ordered_at: String(r.ordered_at ?? ""),
  }));
}

export async function fetchReturnsSummary(params: { storeId: string; from: Date; to: Date }) {
  const items = await fetchItems(params);
  const returnedUnits = sum(items.map((it) => Math.max(0, Number(it.returned_quantity ?? 0))));
  const netUnits = sum(
    items.map((it) =>
      Math.max(0, Number(it.quantity ?? 0) - Math.max(0, Number(it.returned_quantity ?? 0)))
    )
  );
  const returnedRevenue = sum(items.map(estimateReturnedRevenue));
  const returnRate = safeDivide(returnedUnits, returnedUnits + netUnits);

  // MVP: COGS netUnits üzerinden hesaplandığı için, iade kâr etkisini basitçe iade ciro kaybı olarak gösteriyoruz.
  const estimatedProfitImpact = -Math.abs(returnedRevenue);

  return {
    returnedUnits,
    returnRate,
    returnedRevenue,
    estimatedProfitImpact,
  } satisfies ReturnSummary;
}

export async function fetchReturnsBySku(params: { storeId: string; from: Date; to: Date; limit?: number }) {
  const items = await fetchItems(params);
  const nameBySku = isDemoMode() ? buildNameBySku(params.storeId) : new Map<string, string>();

  const map = new Map<
    string,
    { returnedUnits: number; units: number; returnedRevenue: number; name: string }
  >();

  for (const it of items) {
    const sku = String(it.sku);
    const row =
      map.get(sku) ??
      ({
        returnedUnits: 0,
        units: 0,
        returnedRevenue: 0,
        name: String(it.name ?? nameBySku.get(sku) ?? sku),
      } satisfies { returnedUnits: number; units: number; returnedRevenue: number; name: string });

    const qty = Number(it.quantity ?? 0);
    const returned = Math.max(0, Number(it.returned_quantity ?? 0));
    row.returnedUnits += returned;
    row.units += Math.max(0, qty - returned);
    row.returnedRevenue += estimateReturnedRevenue(it);

    map.set(sku, row);
  }

  const rows = Array.from(map.entries())
    .map(([sku, v]) => ({
      sku,
      name: v.name,
      returnedUnits: v.returnedUnits,
      returnRate: safeDivide(v.returnedUnits, v.returnedUnits + v.units),
      returnedRevenue: v.returnedRevenue,
    }))
    .filter((r) => r.returnedUnits > 0)
    .sort((a, b) => b.returnedRevenue - a.returnedRevenue);

  return rows.slice(0, params.limit ?? 20) as ReturnSkuRow[];
}

export async function fetchReturnsTimeseries(params: { storeId: string; from: Date; to: Date }) {
  const days = enumerateDates(params.from, params.to);
  const items = await fetchItems(params);

  const byDay = new Map<string, { units: number; revenue: number }>();
  for (const it of items) {
    const returned = Math.max(0, Number(it.returned_quantity ?? 0));
    if (returned <= 0) continue;
    const d = toLocalISODate(new Date(String(it.ordered_at)));
    const prev = byDay.get(d) ?? { units: 0, revenue: 0 };
    prev.units += returned;
    prev.revenue += estimateReturnedRevenue(it);
    byDay.set(d, prev);
  }

  return days.map((d) => ({
    date: d,
    returnedUnits: byDay.get(d)?.units ?? 0,
    returnedRevenue: byDay.get(d)?.revenue ?? 0,
  })) satisfies ReturnPoint[];
}
