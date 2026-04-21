"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "@/components/app/app-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TD, TH, THead, TRow } from "@/components/ui/table";
import { fetchOrders, type OrderRow } from "@/lib/queries/orders";
import { downloadCsv, toCsv } from "@/lib/csv";

function formatCurrencyTRY(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusBadge(status: string) {
  const s = String(status);
  if (s === "odendi") return <Badge variant="success">Ödendi</Badge>;
  if (s === "beklemede") return <Badge variant="warning">Beklemede</Badge>;
  if (s === "iade") return <Badge variant="danger">İade</Badge>;
  if (s === "iptal") return <Badge variant="default">İptal</Badge>;
  return <Badge variant="default">{s}</Badge>;
}

function shortDateTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function sum(values: number[]) {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

export function OrdersView() {
  const { storeId, dateRange } = useAppState();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "odendi" | "beklemede" | "iade" | "iptal">(
    "all"
  );

  const ordersQuery = useQuery({
    queryKey: ["orders", storeId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () =>
      fetchOrders({ storeId: storeId!, from: dateRange.from, to: dateRange.to }),
    enabled: Boolean(storeId),
  });

  const filtered = useMemo(() => {
    const rows = ordersQuery.data ?? [];
    const query = q.trim().toLowerCase();
    return rows
      .filter((o) => {
        if (status === "all") return true;
        return String(o.status) === status;
      })
      .filter((o) => {
        if (!query) return true;
        return (
          String(o.id).toLowerCase().includes(query) ||
          String(o.customer_id ?? "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => String(b.ordered_at).localeCompare(String(a.ordered_at)));
  }, [ordersQuery.data, q, status]);

  const stats = useMemo(() => {
    const paid = filtered.filter((o) => o.status === "odendi");
    const waiting = filtered.filter((o) => o.status === "beklemede");
    const refunded = filtered.filter((o) => o.status === "iade");
    const cancelled = filtered.filter((o) => o.status === "iptal");
    const gross = sum(paid.map((o) => o.amount));
    const aov = paid.length > 0 ? gross / paid.length : null;
    return {
      total: filtered.length,
      paid: paid.length,
      waiting: waiting.length,
      refunded: refunded.length,
      cancelled: cancelled.length,
      gross,
      aov,
    };
  }, [filtered]);

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

  if (ordersQuery.isLoading) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-300">Siparişler yükleniyor…</div>
    );
  }

  if (ordersQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-rose-700 dark:text-rose-200">
          Siparişler alınamadı. (Supabase tabloları/izinleri kontrol edin.)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Brüt Ciro (Ödendi)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrencyTRY(stats.gross)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Seçili tarih aralığı
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ödendi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.paid}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sipariş</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Beklemede</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.waiting}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sipariş</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>İade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.refunded}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sipariş</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AOV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stats.aov == null ? "—" : formatCurrencyTRY(stats.aov)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ödendi sipariş ortalaması
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Sipariş Listesi</CardTitle>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const rows = filtered.map((o) => ({
                  id: o.id,
                  customer_id: o.customer_id ?? "",
                  status: o.status,
                  amount_try: Math.round(o.amount),
                  tax_try: Math.round(o.tax),
                  shipping_try: Math.round(o.shipping),
                  ordered_at: o.ordered_at,
                }));
                const csv = toCsv(rows);
                downloadCsv("netprofithub_siparisler.csv", csv);
              }}
              disabled={filtered.length === 0}
            >
              CSV İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block md:col-span-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Ara (Sipariş ID / Müşteri ID)
              </span>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Örn: o12 veya c3" />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">Durum</span>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "all" | "odendi" | "beklemede" | "iade" | "iptal")
                }
                className="h-9 w-full rounded-md border border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-400/30"
              >
                <option value="all">Tümü</option>
                <option value="odendi">Ödendi</option>
                <option value="beklemede">Beklemede</option>
                <option value="iade">İade</option>
                <option value="iptal">İptal</option>
              </select>
            </label>
          </div>

          <Table>
            <THead>
              <TRow className="border-b-0">
                <TH>Sipariş</TH>
                <TH>Müşteri</TH>
                <TH>Durum</TH>
                <TH className="text-right">Tutar</TH>
                <TH className="text-right">Vergi</TH>
                <TH className="text-right">Kargo</TH>
                <TH className="text-right">Tarih</TH>
              </TRow>
            </THead>
            <tbody>
              {filtered.slice(0, 200).map((o: OrderRow) => (
                <TRow key={o.id}>
                  <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">{o.id}</TD>
                  <TD className="font-mono text-xs text-slate-600 dark:text-slate-300">
                    {o.customer_id ?? "—"}
                  </TD>
                  <TD>{statusBadge(o.status)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(o.amount)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(o.tax)}</TD>
                  <TD className="text-right tabular-nums">{formatCurrencyTRY(o.shipping)}</TD>
                  <TD className="text-right tabular-nums">{shortDateTime(o.ordered_at)}</TD>
                </TRow>
              ))}
            </tbody>
          </Table>

          {filtered.length === 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-300">Sonuç yok.</div>
          )}
          {filtered.length > 200 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Performans için ilk 200 satır gösteriliyor. CSV ile tamamını indirebilirsiniz.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
