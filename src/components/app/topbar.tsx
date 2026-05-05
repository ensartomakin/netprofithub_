import { DateRangePicker } from "@/components/app/date-range-picker";
import { StoreSwitcher } from "@/components/app/store-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SignOutButton } from "@/components/app/sign-out-button";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/40 dark:bg-slate-950/30 backdrop-blur px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <StoreSwitcher />
        <DateRangePicker />
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
