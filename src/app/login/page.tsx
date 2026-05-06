"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (signInError) throw signInError;
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderilemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>NetProfitHub&apos;a Giriş</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "email" ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                E-posta adresinize 6 haneli doğrulama kodu göndereceğiz.
              </p>
              <form onSubmit={sendOtp} className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">E-posta</span>
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
                  {loading ? "Gönderiliyor…" : "Doğrulama Kodu Gönder"}
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                <strong>{email}</strong> adresine 6 haneli kod gönderildi. Spam klasörünü de kontrol edin.
              </p>
              <form onSubmit={verifyOtp} className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Doğrulama Kodu</span>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="123456"
                    className="mt-1 w-full h-10 rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-950/30 px-3 outline-none focus:ring-2 focus:ring-slate-400/30 text-center text-lg tracking-widest"
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Doğrulanıyor…" : "Giriş Yap"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setStep("email"); setOtp(""); setError(null); }}
                  >
                    Geri
                  </Button>
                </div>
              </form>
            </>
          )}

          {error && (
            <div className="text-sm text-rose-700 dark:text-rose-200">{error}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
