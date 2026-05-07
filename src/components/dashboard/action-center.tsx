"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ActionItem = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger" | "success";
};

const variantBySeverity: Record<ActionItem["severity"], Parameters<typeof Badge>[0]["variant"]> = {
  info: "default",
  success: "success",
  warning: "warning",
  danger: "danger",
};

/* Left-border accent per severity, warm-gray background */
const accentBySeverity: Record<ActionItem["severity"], string> = {
  info: "border-l-[3px] border-frosted-glass bg-warm-gray",
  success: "border-l-[3px] border-[#1dc479] bg-[#1dc479]/5",
  warning: "border-l-[3px] border-[#e8a020] bg-[#e8a020]/5",
  danger: "border-l-[3px] border-[#eb3131] bg-[#eb3131]/5",
};

export function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aksiyon Merkezi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <div className="text-sm text-dark-overlay">Şu an belirgin bir aksiyon yok.</div>
        )}
        {items.map((it) => (
          <div
            key={it.title}
            className={`rounded-r-[16px] pl-4 pr-4 py-3 ${accentBySeverity[it.severity]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm text-charcoal-text">{it.title}</div>
              <Badge variant={variantBySeverity[it.severity]}>
                {it.severity === "danger" ? "Kritik"
                  : it.severity === "warning" ? "Uyarı"
                  : it.severity === "success" ? "İyi"
                  : "Bilgi"}
              </Badge>
            </div>
            <div className="text-xs text-dark-overlay mt-1.5 leading-relaxed">{it.detail}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
