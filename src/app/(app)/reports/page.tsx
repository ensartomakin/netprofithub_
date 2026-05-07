import { Topbar } from "@/components/app/topbar";
import { ReportsView } from "@/components/reports/reports-view";

export default function ReportsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Raporlar" />
      <main className="px-8 pb-8 space-y-5">
        <ReportsView />
      </main>
    </div>
  );
}

