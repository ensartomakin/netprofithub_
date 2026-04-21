import type { OrderItemRow } from "@/lib/queries/order-items";

export type SkuProfit = {
  sku: string;
  units: number;
  revenue: number;
  returnsUnits: number;
};

export type SkuProfitDetailed = {
  sku: string;
  unitsNet: number;
  unitsReturned: number;
  revenueGross: number;
  revenueReturned: number;
  revenueNet: number;
};

export function aggregateSkuProfit(items: OrderItemRow[]) {
  const map = new Map<string, SkuProfit>();

  for (const item of items) {
    const sku = String(item.sku);
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    const discount = Number(item.discount ?? 0);
    const returnedQty = Number(item.returned_quantity ?? 0);

    const row =
      map.get(sku) ??
      ({
        sku,
        units: 0,
        revenue: 0,
        returnsUnits: 0,
      } satisfies SkuProfit);

    // Net units (iade ayrı tutulur)
    row.units += Math.max(0, quantity - returnedQty);
    row.returnsUnits += Math.max(0, returnedQty);

    // Basit revenue: qty * price - discount
    row.revenue += quantity * unitPrice - discount;

    map.set(sku, row);
  }

  return Array.from(map.values());
}

export function aggregateSkuProfitDetailed(items: OrderItemRow[]) {
  const map = new Map<string, SkuProfitDetailed>();

  for (const item of items) {
    const sku = String(item.sku);
    const quantity = Math.max(0, Number(item.quantity ?? 0));
    const unitPrice = Number(item.unit_price ?? 0);
    const discount = Number(item.discount ?? 0);
    const returnedQty = Math.max(0, Number(item.returned_quantity ?? 0));
    const netUnits = Math.max(0, quantity - returnedQty);

    const grossRevenue = quantity * unitPrice - discount;
    const returnedRevenue =
      quantity > 0 ? returnedQty * unitPrice - discount * (returnedQty / quantity) : 0;
    const netRevenue = grossRevenue - returnedRevenue;

    const row =
      map.get(sku) ??
      ({
        sku,
        unitsNet: 0,
        unitsReturned: 0,
        revenueGross: 0,
        revenueReturned: 0,
        revenueNet: 0,
      } satisfies SkuProfitDetailed);

    row.unitsNet += netUnits;
    row.unitsReturned += returnedQty;
    row.revenueGross += grossRevenue;
    row.revenueReturned += returnedRevenue;
    row.revenueNet += netRevenue;

    map.set(sku, row);
  }

  return Array.from(map.values());
}

export function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}
