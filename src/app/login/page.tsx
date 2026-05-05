"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSent(false);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : undefined,
        },
      });
      if (signInError) throw signInError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>NetProfitHub'a Giriş</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            E-posta adresinize tek kullanımlık giriş bağlantısı göndereceğiz.
          </p>
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                E-posta
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                placeholder="ornek@domain.com"
                className="mt-1 w-full h-10 rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/30 px-3 outline-none focus:ring-2 focus:ring-slate-400/30"
              />
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? "Gönderiliyor…" : "Giriş Bağlantısı Gönder"}
            </Button>
          </form>
          {sent && (
            <div className="text-sm text-emerald-700 dark:text-emerald-200">
              Bağlantı gönderildi. E-postanızı kontrol edin.
            </div>
          )}
          {error && (
            <div className="text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
