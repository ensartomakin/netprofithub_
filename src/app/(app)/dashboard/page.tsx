import { Topbar } from "@/components/app/topbar";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Dashboard" />
      <main className="px-6 py-6 space-y-6">
        <DashboardView />
      </main>
    </div>
  );
}
