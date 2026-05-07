"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ActionItem = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger" | "success";
};

const variantBySeverity: Record<
  ActionItem["severity"],
  Parameters<typeof Badge>[0]["variant"]
> = {
  info: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
};

const borderBySeverity: Record<ActionItem["severity"], string> = {
  info: "border-stone",
  success: "border-[#1dc479]/30",
  warning: "border-amber-200",
  danger: "border-[#eb3131]/30",
};

const bgBySeverity: Record<ActionItem["severity"], string> = {
  info: "bg-parchment-card",
  success: "bg-[#1dc479]/5",
  warning: "bg-amber-50/60",
  danger: "bg-[#eb3131]/5",
};

export function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aksiyon Merkezi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <div className="text-sm text-graphite">Şu an belirgin bir aksiyon yok.</div>
        )}
        {items.map((it) => (
          <div
            key={it.title}
            className={`rounded-[26px] border p-4 ${borderBySeverity[it.severity]} ${bgBySeverity[it.severity]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm text-near-black">{it.title}</div>
              <Badge variant={variantBySeverity[it.severity]}>
                {it.severity === "danger"
                  ? "Kritik"
                  : it.severity === "warning"
                  ? "Uyarı"
                  : it.severity === "success"
                  ? "İyi"
                  : "Bilgi"}
              </Badge>
            </div>
            <div className="text-xs text-graphite mt-1.5 leading-relaxed">
              {it.detail}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
