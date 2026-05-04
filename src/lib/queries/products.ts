import { getSupabaseClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/mode";
import { demoProducts } from "@/lib/demo/data";
import { loadRealProducts, hasRealProducts } from "@/lib/demo/real-store";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  cogs: number;
  stock_level: number;
  velocity: number;
  status: string;
  dnr: boolean;
};

type DemoProductOverride = Partial<Pick<ProductRow, "cogs" | "dnr" | "status">>;

function loadDemoOverrides(): Record<string, DemoProductOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("nph_demo_product_overrides");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, DemoProductOverride>;
  } catch {
    return {};
  }
}

export async function fetchProducts(params: { storeId: string }) {
  if (isDemoMode()) {
    // Real Tsoft data takes priority over static demo products
    if (hasRealProducts(params.storeId)) {
      const real = loadRealProducts(params.storeId);
      const overrides = loadDemoOverrides();
      return real.map((p, i) => ({
        id: `real-${p.sku}-${i}`,
        sku: p.sku,
        name: p.name,
        stock_level: p.stock_level,
        velocity: 0,
        status: overrides[`real-${p.sku}-${i}`]?.status ?? p.status,
        dnr: overrides[`real-${p.sku}-${i}`]?.dnr ?? (p.dnr ?? false),
        cogs: overrides[`real-${p.sku}-${i}`]?.cogs ?? (p.cogs ?? 0),
      })) as unknown as ProductRow[];
    }

    const overrides = loadDemoOverrides();
    return demoProducts
      .filter((p) => p.store_id === params.storeId)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock_level: p.stock_level,
        velocity: p.velocity,
        status: overrides[p.id]?.status ?? p.status,
        dnr: overrides[p.id]?.dnr ?? p.dnr,
        cogs: overrides[p.id]?.cogs ?? p.cogs,
      })) as unknown as ProductRow[];
  }
  const supabase = getSupabaseClient();
  const { storeId } = params;
  const { data, error } = await supabase
    .from("products")
    .select("id,sku,name,stock_level,velocity,status,dnr,cogs")
    .eq("store_id", storeId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProductRow[];
}
