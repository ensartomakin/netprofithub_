"use client";

import { useMemo, useState } from "react";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDashboardTargets } from "@/components/dashboard/use-dashboard-targets";
import { useProfitOverrides } from "@/components/finance/use-profit-overrides";
import { isDemoMode } from "@/lib/demo/mode";

function clearKeys(storeId: string) {
  const keys = [
    `nph_targets_${storeId}`,
    `nph_profit_overrides:${storeId}`,
    `nph_demo_expenses:${storeId}`,
    `nph_demo_integrations:${storeId}`,
    "nph_demo_product_overrides",
  ];
  for (const k of keys) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }
}

export function SettingsView() {
  const { storeId } = useAppState();
  const { targets, setTargets } = useDashboardTargets(storeId);
  const { overrides, setOverrides, reset } = useProfitOverrides(storeId);
  const [confirm, setConfirm] = useState(false);

  const resetLabel = useMemo(() => {
    if (!storeId) return "Sıfırla";
    return confirm ? "Eminim, sıfırla" : "Local veriyi sıfırla";
  }, [confirm, storeId]);

  if (!storeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Başlamak için</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-300">
          Üst bardan bir mağaza seçin veya “Mağaza Oluştur” ile ilk mağazanızı oluşturun.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Ayarlar</CardTitle>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  MVP: Tüm ayarlar localStorage’da tutulur. Supabase persist en son aşamada açılacak.
                </div>
              </div>
              {isDemoMode() && <Badge variant="warning">Demo Modu</Badge>}
            </div>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
            <div>Mağaza bazlı hedefler ve profit varsayımları burada yönetilir.</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Not: Entegrasyonlar için `Entegrasyonlar` sayfasını kullanın.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hızlı Linkler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a className="text-sm underline text-slate-700 dark:text-slate-200" href="/finance">
              Finans (P&amp;L)
            </a>
            <a className="text-sm underline text-slate-700 dark:text-slate-200" href="/marketing">
              Pazarlama
            </a>
            <a
              className="text-sm underline text-slate-700 dark:text-slate-200"
              href="/settings/integrations"
            >
              Entegrasyonlar
            </a>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Hedefleri</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 items-end">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Aylık Ciro Hedefi (₺)
              </span>
              <Input
                type="number"
                step="1"
                value={targets.revenueTarget}
                onChange={(e) =>
                  setTargets((t) => ({ ...t, revenueTarget: Number(e.target.value || 0) }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">ROI/ROAS Hedefi</span>
              <Input
                type="number"
                step="0.1"
                value={targets.roiTarget}
                onChange={(e) =>
                  setTargets((t) => ({ ...t, roiTarget: Number(e.target.value || 0) }))
                }
              />
            </label>
            <div className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">
              Bu hedefler Dashboard’daki “Ay Özeti” alanına yansır.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit Varsayımları</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 items-end">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Kargo Maliyeti / Sipariş (₺)
              </span>
              <Input
                type="number"
                step="1"
                value={overrides.shippingCostPerOrder}
                onChange={(e) => setOverrides({ shippingCostPerOrder: Number(e.target.value || 0) })}
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Pazaryeri Komisyon Oranı (%)
              </span>
              <Input
                type="number"
                step="0.1"
                value={Math.round(overrides.marketplaceFeeRate * 1000) / 10}
                onChange={(e) => setOverrides({ marketplaceFeeRate: Number(e.target.value || 0) / 100 })}
              />
            </label>
            <div className="md:col-span-2 flex items-center justify-end">
              <Button type="button" variant="secondary" onClick={reset}>
                Varsayılan
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Local Veri Yönetimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Demo/MVP sırasında yaptığınız değişiklikleri (hedefler, profit ayarları, demo giderler,
            demo entegrasyonlar, demo ürün override’ları) sıfırlar.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={confirm ? "primary" : "secondary"}
              onClick={() => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                clearKeys(storeId);
                window.location.reload();
              }}
            >
              {resetLabel}
            </Button>
            {confirm && (
              <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>
                Vazgeç
              </Button>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Bu işlem geri alınamaz. Sadece localStorage temizlenir.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

