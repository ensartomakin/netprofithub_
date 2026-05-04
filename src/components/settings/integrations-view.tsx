"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  disconnectIntegration,
  fetchIntegrationStates,
  getIntegrationCatalog,
  upsertIntegrationState,
  type IntegrationCatalogItem,
  type IntegrationKey,
} from "@/lib/queries/integrations";
import { isDemoMode } from "@/lib/demo/mode";
import { getSession } from "@/lib/auth/session";

type Draft = Record<string, string>;
type SyncResult = { synced?: number; syncedOrders?: number; syncedItems?: number; updatedItems?: number; demo?: boolean };
type SyncState = { status: "idle" | "loading" | "ok" | "error"; message?: string };

function asString(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function requiredBadge(required: boolean) {
  return required ? <Badge variant="warning">Gerekli</Badge> : <Badge variant="default">Opsiyonel</Badge>;
}

function statusBadge(connected: boolean) {
  return connected ? <Badge variant="success">Bağlı</Badge> : <Badge variant="default">Bağlı Değil</Badge>;
}

function categoryTitle(cat: IntegrationCatalogItem["category"]) {
  if (cat === "altyapi") return "Altyapı (E-ticaret)";
  if (cat === "pazaryeri") return "Pazaryerleri";
  return "Reklam Mecraları";
}

function categoryHint(cat: IntegrationCatalogItem["category"]) {
  if (cat === "altyapi") return "Ürün/sipariş/iade kaynak verisi buradan gelir.";
  if (cat === "pazaryeri") return "Pazaryeri satışları ve envanter güncellemeleri.";
  return "Harcama ve kampanya performansı.";
}

function buildEmptyDraft(item: IntegrationCatalogItem) {
  const draft: Draft = {};
  for (const f of item.fields) draft[f.key] = "";
  return draft;
}

export function IntegrationsView() {
  const { storeId } = useAppState();
  const qc = useQueryClient();
  const catalog = getIntegrationCatalog();

  const [openKey, setOpenKey] = useState<IntegrationKey | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<IntegrationKey, Draft>>>({});

  const statesQuery = useQuery({
    queryKey: ["integrationStates", storeId],
    queryFn: () => fetchIntegrationStates({ storeId: storeId! }),
    enabled: Boolean(storeId),
  });

  const upsertMutation = useMutation({
    mutationFn: async (args: { key: IntegrationKey; values: Draft; requiredKeys: string[] }) => {
      const clean: Record<string, string> = {};
      for (const k of args.requiredKeys) clean[k] = asString(args.values[k]).trim();
      // include any other filled fields (optional)
      for (const [k, v] of Object.entries(args.values)) {
        const s = asString(v).trim();
        if (s.length > 0) clean[k] = s;
      }
      return upsertIntegrationState({ storeId: storeId!, key: args.key, values: clean });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["integrationStates", storeId] });
      await qc.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (args: { key: IntegrationKey }) =>
      disconnectIntegration({ storeId: storeId!, key: args.key }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["integrationStates", storeId] });
      await qc.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});

  async function runSync(endpoint: string, label: string) {
    const key = endpoint;
    setSyncStates((prev: Record<string, SyncState>) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const session = await getSession();
      const token = session?.access_token ?? "";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ storeId }),
      });
      const json = (await res.json()) as SyncResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const parts: string[] = [];
      if (json.synced != null) parts.push(`${json.synced} ürün`);
      if (json.syncedOrders != null) parts.push(`${json.syncedOrders} sipariş`);
      if (json.syncedItems != null) parts.push(`${json.syncedItems} kalem`);
      if (json.updatedItems != null) parts.push(`${json.updatedItems} iade güncellendi`);
      if (json.demo) parts.push("(demo)");
      setSyncStates((prev: Record<string, SyncState>) => ({
        ...prev,
        [key]: { status: "ok", message: parts.join(", ") || label + " tamam" },
      }));
      await qc.invalidateQueries({ queryKey: ["products", storeId] });
      await qc.invalidateQueries({ queryKey: ["orders", storeId] });
    } catch (e) {
      setSyncStates((prev: Record<string, SyncState>) => ({
        ...prev,
        [key]: { status: "error", message: e instanceof Error ? e.message : "Hata" },
      }));
    }
  }

  const grouped = useMemo(() => {
    const map: Record<IntegrationCatalogItem["category"], IntegrationCatalogItem[]> = {
      altyapi: [],
      pazaryeri: [],
      reklam: [],
    };
    for (const item of catalog) map[item.category].push(item);
    return map;
  }, [catalog]);

  const requiredKeys = useMemo(() => catalog.filter((x) => x.required).map((x) => x.key), [catalog]);
  const requiredConnected = useMemo(() => {
    const st = statesQuery.data;
    if (!st) return 0;
    return requiredKeys.filter((k) => Boolean(st[k]?.connected)).length;
  }, [requiredKeys, statesQuery.data]);

  if (!storeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Başlamak için</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 dark:text-slate-300">
          Önce bir mağaza seçin.
        </CardContent>
      </Card>
    );
  }

  if (statesQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Entegrasyon durumları yükleniyor…
      </div>
    );
  }

  if (statesQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Entegrasyon durumları alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  const states = statesQuery.data!;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Bağlantı Merkezi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                Gerekli entegrasyonlar bağlı değilse raporlarınız eksik görünebilir.
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={requiredConnected === requiredKeys.length ? "success" : "warning"}>
                  {requiredConnected}/{requiredKeys.length} gerekli bağlı
                </Badge>
                {isDemoMode() && <Badge variant="warning">Demo Modu</Badge>}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3 text-xs text-slate-500 dark:text-slate-400">
              Güvenlik notu: Token/şifreler hassastır. MVP’de değerler Supabase `stores.api_keys` alanında saklanır.
              Prod’da şifreleme/secret manager önerilir.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Önerilen Sıra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span>1) Altyapı (Tsoft)</span>
              {states.tsoft?.connected ? <Badge variant="success">Bağlı</Badge> : <Badge variant="warning">Gerekli</Badge>}
            </div>
            <div className="flex items-center justify-between">
              <span>2) Pazaryerleri</span>
              <Badge variant="default">MVP</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>3) Reklam Mecraları</span>
              <Badge variant="default">MVP</Badge>
            </div>
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              Tsoft bağlandıktan sonra senkronize et butonuyla veri çekin.
            </div>
          </CardContent>
        </Card>
      </section>

      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => (
        <section key={cat} className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{categoryTitle(cat)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {categoryHint(cat)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {grouped[cat].map((item) => {
              const state = states[item.key];
              const connected = Boolean(state?.connected);
              const isOpen = openKey === item.key;
              const draft =
                drafts[item.key] ??
                (connected ? (state?.values ?? {}) : buildEmptyDraft(item));

              return (
                <Card key={item.key} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle>{item.title}</CardTitle>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {item.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {requiredBadge(item.required)}
                        {statusBadge(connected)}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setOpenKey((prev) => (prev === item.key ? null : item.key));
                          setDrafts((prev) => ({
                            ...prev,
                            [item.key]: connected
                              ? { ...(state?.values ?? {}) }
                              : { ...buildEmptyDraft(item) },
                          }));
                        }}
                      >
                        {isOpen ? "Kapat" : connected ? "Ayarları Gör" : "Bağla"}
                      </Button>

                      {connected && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectMutation.mutate({ key: item.key })}
                          disabled={disconnectMutation.isPending}
                        >
                          Bağlantıyı Kaldır
                        </Button>
                      )}

                      {upsertMutation.isPending && openKey === item.key && (
                        <Badge variant="default">Kaydediliyor…</Badge>
                      )}
                      {disconnectMutation.isPending && (
                        <Badge variant="default">Güncelleniyor…</Badge>
                      )}
                    </div>

                    {item.key === "tsoft" && connected && (
                      <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Veri Senkronizasyonu
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { endpoint: "/api/integrations/tsoft/sync-store", label: "Ürünler" },
                            { endpoint: "/api/integrations/tsoft/sync-orders-store", label: "Siparişler" },
                            { endpoint: "/api/integrations/tsoft/sync-refunds-store", label: "İadeler" },
                          ].map(({ endpoint, label }) => {
                            const s = syncStates[endpoint] ?? { status: "idle" };
                            return (
                              <div key={endpoint} className="flex flex-col gap-1">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={s.status === "loading"}
                                  onClick={() => runSync(endpoint, label)}
                                >
                                  {s.status === "loading" ? `${label} yükleniyor…` : `${label} Senkronize Et`}
                                </Button>
                                {s.status === "ok" && (
                                  <span className="text-xs text-emerald-600 dark:text-emerald-400">{s.message}</span>
                                )}
                                {s.status === "error" && (
                                  <span className="text-xs text-rose-600 dark:text-rose-400">{s.message}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isOpen && (
                      <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 p-4 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          {item.fields.map((f) => (
                            <label key={f.key} className="block">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {f.label}
                              </span>
                              <Input
                                type={f.secret ? "password" : "text"}
                                value={draft[f.key] ?? ""}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [item.key]: { ...(prev[item.key] ?? {}), [f.key]: next },
                                  }));
                                }}
                                placeholder={f.placeholder}
                                autoComplete="off"
                              />
                            </label>
                          ))}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Kayıt: Bilgileri kaydettikten sonra senkronize edin.
                          </div>
                          <Button
                            type="button"
                            onClick={() =>
                              upsertMutation.mutate({
                                key: item.key,
                                values: draft,
                                requiredKeys: item.fields.map((x) => x.key),
                              })
                            }
                            disabled={upsertMutation.isPending}
                          >
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    )}

                    {upsertMutation.isError && openKey === item.key && (
                      <div className="text-sm text-rose-700 dark:text-rose-200">
                        {upsertMutation.error instanceof Error
                          ? upsertMutation.error.message
                          : "Kaydedilemedi."}
                      </div>
                    )}
                    {disconnectMutation.isError && (
                      <div className="text-sm text-rose-700 dark:text-rose-200">
                        {disconnectMutation.error instanceof Error
                          ? disconnectMutation.error.message
                          : "Bağlantı kaldırılamadı."}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
