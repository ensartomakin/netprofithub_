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
    /* Level 1 surface — parchment-card (#fafaf5) sits one step above warm-cream page */
    <aside className="w-[240px] shrink-0 bg-parchment-card flex flex-col">
      {/* Logo — lime accent mark */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[26px] bg-electric-lime text-near-black grid place-items-center font-medium text-sm shrink-0 select-none">
            N
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-near-black">NetProfitHub</div>
            <div className="text-[11px] text-graphite tracking-[0.06em]">DASHBOARD</div>
          </div>
        </div>
      </div>

      {/* Thin divider between logo and nav */}
      <div className="mx-5 h-px bg-stone mb-2" />

      {/* Nav links */}
      <nav className="px-3 py-2 flex-1 space-y-0.5">
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
                  ? "bg-near-black text-white font-medium"
                  : "text-graphite hover:bg-stone/40 hover:text-near-black"
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
