import { getSupabaseClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/mode";
import { demoProducts } from "@/lib/demo/data";

type DemoProductOverride = Partial<{ cogs: number; dnr: boolean; status: string }>;

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

function saveDemoOverrides(next: Record<string, DemoProductOverride>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("nph_demo_product_overrides", JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function updateProductCogs(params: { id: string; cogs: number }) {
  if (isDemoMode()) {
    const p = demoProducts.find((x) => x.id === params.id);
    if (p) p.cogs = params.cogs;

    const overrides = loadDemoOverrides();
    overrides[params.id] = { ...(overrides[params.id] ?? {}), cogs: params.cogs };
    saveDemoOverrides(overrides);
    return;
  }
  const supabase = getSupabaseClient();
  const { id, cogs } = params;

  const { error } = await supabase.from("products").update({ cogs }).eq("id", id);
  if (error) throw error;
}

export async function updateProductDnr(params: { id: string; dnr: boolean }) {
  if (isDemoMode()) {
    const p = demoProducts.find((x) => x.id === params.id);
    if (p) p.dnr = params.dnr;

    const overrides = loadDemoOverrides();
    overrides[params.id] = { ...(overrides[params.id] ?? {}), dnr: params.dnr };
    saveDemoOverrides(overrides);
    return;
  }
  const supabase = getSupabaseClient();
  const { id, dnr } = params;
  const { error } = await supabase.from("products").update({ dnr }).eq("id", id);
  if (error) throw error;
}

export async function updateProductStatus(params: { id: string; status: string }) {
  if (isDemoMode()) {
    const p = demoProducts.find((x) => x.id === params.id);
    if (p) p.status = params.status;

    const overrides = loadDemoOverrides();
    overrides[params.id] = { ...(overrides[params.id] ?? {}), status: params.status };
    saveDemoOverrides(overrides);
    return;
  }
  const supabase = getSupabaseClient();
  const { id, status } = params;
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) throw error;
}
