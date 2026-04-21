import type { OrderItemRow } from "@/lib/queries/order-items";

export type SkuProfit = {
  sku: string;
  units: number;
  revenue: number;
  returnsUnits: number;
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

export function safeDivide(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

