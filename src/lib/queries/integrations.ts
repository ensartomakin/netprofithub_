import { getSupabaseClient } from "@/lib/supabase/client";

export type IntegrationKey =
  | "tsoft"
  | "shopify"
  | "trendyol"
  | "hepsiburada"
  | "amazon"
  | "google_ads"
  | "meta_ads"
  | "pinterest_ads"
  | "tiktok_ads";

export type IntegrationState = {
  connected: boolean;
  values: Record<string, string>;
  updatedAt?: string | null;
};

export type IntegrationCatalogItem = {
  key: IntegrationKey;
  category: "altyapi" | "pazaryeri" | "reklam";
  title: string;
  description: string;
  required: boolean;
  fields: Array<{ key: string; label: string; placeholder?: string; secret?: boolean }>;
};

const CATALOG: IntegrationCatalogItem[] = [
  {
    key: "tsoft",
    category: "altyapi",
    title: "Tsoft",
    description: "E-ticaret altyapısı (ürün/sipariş/iadeler).",
    required: true,
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://magaza.tsoft.com.tr" },
      { key: "api_user", label: "Kullanıcı Adı" },
      { key: "api_pass", label: "Şifre", secret: true },
    ],
  },
  {
    key: "shopify",
    category: "altyapi",
    title: "Shopify",
    description: "Alternatif altyapı (Shopify Admin API).",
    required: false,
    fields: [
      { key: "shop_domain", label: "Shop Domain", placeholder: "mystore.myshopify.com" },
      { key: "access_token", label: "Access Token", secret: true },
      { key: "api_version", label: "API Versiyonu", placeholder: "2024-10" },
    ],
  },
  {
    key: "trendyol",
    category: "pazaryeri",
    title: "Trendyol",
    description: "Pazaryeri satışları ve iade akışı.",
    required: true,
    fields: [
      { key: "seller_id", label: "Satıcı ID", placeholder: "123456" },
      { key: "api_key", label: "API Key", secret: true },
      { key: "api_secret", label: "API Secret", secret: true },
    ],
  },
  {
    key: "hepsiburada",
    category: "pazaryeri",
    title: "Hepsiburada",
    description: "Pazaryeri satışları ve envanter güncellemeleri.",
    required: true,
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "HB-XXXX" },
      { key: "username", label: "Kullanıcı Adı" },
      { key: "password", label: "Şifre", secret: true },
    ],
  },
  {
    key: "amazon",
    category: "pazaryeri",
    title: "Amazon",
    description: "Amazon SP-API.",
    required: true,
    fields: [
      { key: "seller_id", label: "Seller ID" },
      { key: "refresh_token", label: "Refresh Token", secret: true },
      { key: "lwa_client_id", label: "LWA Client ID", secret: true },
      { key: "lwa_client_secret", label: "LWA Client Secret", secret: true },
    ],
  },
  {
    key: "google_ads",
    category: "reklam",
    title: "Google Ads",
    description: "Harcama/kampanya performansı (Google Ads API).",
    required: true,
    fields: [
      { key: "customer_id", label: "Customer ID", placeholder: "123-456-7890" },
      { key: "developer_token", label: "Developer Token", secret: true },
      { key: "refresh_token", label: "Refresh Token", secret: true },
    ],
  },
  {
    key: "meta_ads",
    category: "reklam",
    title: "Meta Ads",
    description: "Harcama/kampanya performansı (Marketing API).",
    required: true,
    fields: [
      { key: "ad_account_id", label: "Ad Account ID", placeholder: "act_1234567890" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    key: "pinterest_ads",
    category: "reklam",
    title: "Pinterest",
    description: "Harcama/kampanya performansı (Pinterest Ads API).",
    required: true,
    fields: [
      { key: "ad_account_id", label: "Ad Account ID" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
  {
    key: "tiktok_ads",
    category: "reklam",
    title: "TikTok Ads",
    description: "Harcama/kampanya performansı (TikTok Marketing API).",
    required: true,
    fields: [
      { key: "advertiser_id", label: "Advertiser ID" },
      { key: "access_token", label: "Access Token", secret: true },
    ],
  },
];

export function getIntegrationCatalog() {
  return CATALOG;
}

function asRecord(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object") return {};
  return v as Record<string, unknown>;
}

function deriveConnected(values: Record<string, string>) {
  return Object.values(values).some((v) => String(v ?? "").trim().length > 0);
}

function normalizeValues(v: unknown): Record<string, string> {
  const obj = asRecord(v);
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val == null) continue;
    out[k] = String(val);
  }
  return out;
}

function apiKeysToStates(apiKeys: Record<string, unknown>, platform: string | null | undefined) {
  const states: Partial<Record<IntegrationKey, IntegrationState>> = {};

  const shopifyValues =
    "shop_domain" in apiKeys || "access_token" in apiKeys
      ? normalizeValues({ shop_domain: apiKeys["shop_domain"], access_token: apiKeys["access_token"], api_version: apiKeys["api_version"] })
      : normalizeValues(apiKeys["shopify"]);

  states.shopify = {
    connected: platform === "shopify" || deriveConnected(shopifyValues),
    values: shopifyValues,
    updatedAt: null,
  };

  for (const key of ["tsoft", "trendyol", "hepsiburada", "amazon", "google_ads", "meta_ads", "pinterest_ads", "tiktok_ads"] as const) {
    const values = normalizeValues(apiKeys[key]);
    states[key] = {
      connected: (platform === key && key === "tsoft") || deriveConnected(values),
      values,
      updatedAt: null,
    };
  }

  return states as Record<IntegrationKey, IntegrationState>;
}

export async function fetchIntegrationStates(params: { storeId: string }) {
  const { storeId } = params;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("stores")
    .select("platform,api_keys")
    .eq("id", storeId)
    .single();
  if (error) throw error;

  const platform = String(asRecord(data).platform ?? "");
  const api_keys = asRecord(asRecord(data).api_keys);
  return apiKeysToStates(api_keys, platform);
}

export async function upsertIntegrationState(params: {
  storeId: string;
  key: IntegrationKey;
  values: Record<string, string>;
  connected?: boolean;
}) {
  const { storeId, key, values } = params;
  const nextState: IntegrationState = {
    connected: params.connected ?? deriveConnected(values),
    values,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getSupabaseClient();

  const { data: current, error: currentError } = await supabase
    .from("stores")
    .select("platform,api_keys")
    .eq("id", storeId)
    .single();
  if (currentError) throw currentError;

  const currentKeys = asRecord(asRecord(current).api_keys);
  const merged = { ...currentKeys, [key]: values };
  const patch: { api_keys: Record<string, unknown>; platform?: string } = { api_keys: merged };

  if (key === "tsoft" || key === "shopify") patch.platform = key;

  const { error } = await supabase.from("stores").update(patch).eq("id", storeId);
  if (error) throw error;

  return nextState;
}

export async function disconnectIntegration(params: { storeId: string; key: IntegrationKey }) {
  const { storeId, key } = params;
  const supabase = getSupabaseClient();
  const { data: current, error: currentError } = await supabase
    .from("stores")
    .select("api_keys")
    .eq("id", storeId)
    .single();
  if (currentError) throw currentError;

  const currentKeys = asRecord(asRecord(current).api_keys);
  const merged = { ...currentKeys, [key]: {} };
  const { error } = await supabase.from("stores").update({ api_keys: merged }).eq("id", storeId);
  if (error) throw error;
}
