import { Topbar } from "@/components/app/topbar";
import { PnlView } from "@/components/finance/pnl-view";

export default function FinancePage() {
  return (
    <div className="min-h-full">
      <Topbar title="Finans (P&L)" />
      <main className="px-6 py-6 space-y-6">
        <PnlView />
      </main>
    </div>
  );
}

