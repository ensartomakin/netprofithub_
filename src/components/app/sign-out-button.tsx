"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo/mode";

export function SignOutButton() {
  const router = useRouter();

  if (isDemoMode()) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 border border-slate-200/70 dark:border-slate-800/70"
      onClick={async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
        router.replace("/login");
      }}
    >
      <LogOut className="h-4 w-4" />
      Çıkış
    </Button>
  );
}
