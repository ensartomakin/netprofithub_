"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  BrainCircuit,
  Cable,
  LogOut,
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
import { getSupabaseClient } from "@/lib/supabase/client";

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
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    /* Dark surface sidebar — near-black #14140f */
    <aside className="w-[240px] shrink-0 bg-forest-green flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="leading-tight">
          <div className="text-base font-medium text-snow-white tracking-[-0.01em]">
            NetProfitHub<span className="text-pale-green">.</span>
          </div>
          <div className="text-[10px] text-dark-overlay tracking-[0.10em] uppercase mt-0.5">
            SaaS Analytics MVP
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/10 mb-2" />

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
                  ? "bg-pale-green text-forest-green font-medium"
                  : "text-snow-white/70 hover:bg-white/10 hover:text-snow-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom — sign out */}
      <div className="mx-5 h-px bg-white/10 mb-2" />
      <div className="px-3 pb-5">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-[26px] px-3 py-2 text-sm text-snow-white/70 hover:bg-white/10 hover:text-snow-white transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  );
}
