import { DateRangePicker } from "@/components/app/date-range-picker";
import { StoreSwitcher } from "@/components/app/store-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SignOutButton } from "@/components/app/sign-out-button";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone bg-warm-cream dark:bg-charcoal dark:border-charcoal px-6 py-3">
      <div className="min-w-0">
        <h1 className="truncate text-base font-medium text-near-black dark:text-white">
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
