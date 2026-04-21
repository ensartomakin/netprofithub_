import { Topbar } from "@/components/app/topbar";
import { ReportsView } from "@/components/reports/reports-view";

export default function ReportsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Raporlar" />
      <main className="px-6 py-6 space-y-6">
        <ReportsView />
      </main>
    </div>
  );
}

