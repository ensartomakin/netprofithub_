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
    <aside className="w-[240px] shrink-0 border-r border-stone bg-parchment-card dark:bg-charcoal dark:border-charcoal flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone dark:border-charcoal">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[26px] bg-electric-lime text-near-black grid place-items-center font-bold text-sm shrink-0">
            N
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-near-black dark:text-white">NetProfitHub</div>
            <div className="text-xs text-graphite">Dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 flex-1 space-y-0.5">
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
                "flex items-center gap-3 rounded-[26px] px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-near-black text-white font-medium dark:bg-electric-lime dark:text-near-black"
                  : "text-graphite hover:bg-warm-cream hover:text-near-black dark:text-stone dark:hover:bg-charcoal/60 dark:hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
