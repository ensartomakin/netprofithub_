import { Topbar } from "@/components/app/topbar";
import { PnlView } from "@/components/finance/pnl-view";

export default function FinancePage() {
  return (
    <div className="min-h-full">
      <Topbar title="Finans (P&L)" />
      <main className="px-8 pb-8 space-y-5">
        <PnlView />
      </main>
    </div>
  );
}

