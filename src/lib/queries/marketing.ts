import { getSupabaseClient } from "@/lib/supabase/client";
import { toLocalISODate } from "@/lib/date";

export type MarketingSpendRow = {
  id: string;
  platform: string;
  spend: number;
  date: string;
  campaign_name: string | null;
};

function toIsoDate(d: Date) {
  return toLocalISODate(d);
}

export async function fetchMarketingSpend(params: {
  storeId: string;
  from: Date;
  to: Date;
}) {
  const supabase = getSupabaseClient();
  const { storeId, from, to } = params;

  const fromDate = toIsoDate(from);
  const toInclusive = new Date(to);
  toInclusive.setDate(toInclusive.getDate() - 1);
  const toDate = toIsoDate(toInclusive);

  const { data, error } = await supabase
    .from("marketing_spend")
    .select("id,platform,spend,date,campaign_name")
    .eq("store_id", storeId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MarketingSpendRow[];
}
