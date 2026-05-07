import { DateRangePicker } from "@/components/app/date-range-picker";
import { StoreSwitcher } from "@/components/app/store-switcher";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="px-8 pt-8 pb-6 flex items-end justify-between gap-6">
      {/* Left — large page title + store/date subtitle */}
      <div className="min-w-0">
        <h1 className="text-[40px] font-medium text-charcoal-text leading-[1.1] tracking-[-0.02em]">
          {title}
        </h1>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-dark-overlay">
          <StoreSwitcher />
        </div>
      </div>

      {/* Right — date range pills + CTA */}
      <div className="flex items-center gap-3 shrink-0">
        <DateRangePicker />
      </div>
    </header>
  );
}
