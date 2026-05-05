"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { ReactNode } from "react";

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const ready = pathname === "/login" || checked;

  useEffect(() => {
    if (ready) return;

    let mounted = true;
    (async () => {
      try {
        const session = await getSession();
        if (!mounted) return;
        if (!session) {
          router.replace("/login");
          return;
        }
        setChecked(true);
      } catch {
        router.replace("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ready, router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Yükleniyor…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
