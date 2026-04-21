"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type ActionItem = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger" | "success";
};

const variantBySeverity: Record<ActionItem["severity"], Parameters<typeof Badge>[0]["variant"]> =
  {
    info: "default",
    success: "success",
    warning: "warning",
    danger: "danger",
  };

export function ActionCenter({ items }: { items: ActionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aksiyon Merkezi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Şu an belirgin bir aksiyon yok.
          </div>
        )}
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{it.title}</div>
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
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {it.detail}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

