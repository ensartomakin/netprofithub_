"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  BrainCircuit,
  Cable,
  Settings,
  PackageSearch,
  ShoppingCart,
  ReceiptText,
  Rocket,
  RotateCcw,
  Users,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/finance", label: "Finans (P&L)", icon: ReceiptText },
  { href: "/marketing", label: "Pazarlama", icon: Rocket },
  { href: "/orders", label: "Siparişler", icon: ShoppingCart },
  { href: "/products", label: "Ürünler", icon: PackageSearch },
  { href: "/inventory", label: "Envanter", icon: Boxes },
  { href: "/returns", label: "İadeler", icon: RotateCcw },
  { href: "/customers", label: "Müşteriler", icon: Users },
  { href: "/ai-insights", label: "AI İçgörüler", icon: BrainCircuit },
  { href: "/reports", label: "Raporlar", icon: FileDown },
  { href: "/settings", label: "Ayarlar", icon: Settings },
  { href: "/settings/integrations", label: "Entegrasyonlar", icon: Cable },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[260px] shrink-0 border-r border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 grid place-items-center shadow-sm">
            N
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">NetProfitHub</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              MVP
            </div>
          </div>
        </div>
      </div>
      <nav className="px-2 pb-4">
        {nav.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                "text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-900/60",
                active &&
                  "bg-slate-900 text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-950"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
