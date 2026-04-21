export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "1") return true;

  // MVP: Supabase ayarlanmamışsa otomatik olarak dummy/demoya düş.
  // Böylece repo klonlandıktan sonra env gerektirmeden UI görülebilir.
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return !hasSupabaseEnv;
}
