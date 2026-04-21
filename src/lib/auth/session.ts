import { getSupabaseClient } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/demo/mode";

export async function getSession() {
  if (isDemoMode()) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
