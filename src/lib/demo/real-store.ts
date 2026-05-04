// LocalStorage helpers for storing real API data in demo mode.
// Keys: nph_real_products:{storeId}, nph_real_orders:{storeId}, nph_real_returns:{storeId}

export type RealProduct = {
  sku: string;
  name: string;
  stock_level: number;
  status: "aktif" | "pasif";
  cogs?: number;
  velocity?: number;
  dnr?: boolean;
};

export type RealOrder = {
  external_order_id: number;
  amount: number;
  tax: number;
  shipping: number;
  status: "odendi" | "iade" | "iptal" | "beklemede";
  customer_id: string | null;
  ordered_at: string;
};

export type RealOrderItem = {
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

export type RealReturn = { external_line_item_id: number; returned_quantity: number };

function key(type: string, storeId: string) {
  return `nph_real_${type}:${storeId}`;
}

function load<T>(type: string, storeId: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(type, storeId));
    if (!raw) return [];
    return (JSON.parse(raw) as T[]) ?? [];
  } catch {
    return [];
  }
}

function save<T>(type: string, storeId: string, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(type, storeId), JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function clear(type: string, storeId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(type, storeId));
}

export function loadRealProducts(storeId: string): RealProduct[] {
  return load<RealProduct>("products", storeId);
}

export function saveRealProducts(storeId: string, products: RealProduct[]) {
  save("products", storeId, products);
}

export function clearRealProducts(storeId: string) {
  clear("products", storeId);
}

export function hasRealProducts(storeId: string): boolean {
  return loadRealProducts(storeId).length > 0;
}

export function loadRealOrders(storeId: string): RealOrder[] {
  return load<RealOrder>("orders", storeId);
}

export function loadRealOrderItems(storeId: string): RealOrderItem[] {
  return load<RealOrderItem>("order_items", storeId);
}

export function saveRealOrders(storeId: string, orders: RealOrder[], items: RealOrderItem[]) {
  save("orders", storeId, orders);
  save("order_items", storeId, items);
}

export function clearRealOrders(storeId: string) {
  clear("orders", storeId);
  clear("order_items", storeId);
}

export function saveRealReturns(storeId: string, returns: RealReturn[]) {
  // Merge return quantities into stored order items
  const items = loadRealOrderItems(storeId);
  const qtyMap = new Map(returns.map((r) => [r.external_line_item_id, r.returned_quantity]));
  const updated = items.map((it) => ({
    ...it,
    returned_quantity: qtyMap.get(it.external_line_item_id) ?? it.returned_quantity,
  }));
  save("order_items", storeId, updated);
}

export function clearAllRealData(storeId: string) {
  clearRealProducts(storeId);
  clearRealOrders(storeId);
  clear("returns", storeId);
}
