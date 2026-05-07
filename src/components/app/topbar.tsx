import { DateRangePicker } from "@/components/app/date-range-picker";
import { StoreSwitcher } from "@/components/app/store-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SignOutButton } from "@/components/app/sign-out-button";

/* Navigation Bar — #f5f5eb bg, bottom border 1px #d2d2c8, no shadow */
export function Topbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone bg-warm-cream px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-medium text-near-black tracking-[0.04em] uppercase">
          {title}
        </h1>
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
