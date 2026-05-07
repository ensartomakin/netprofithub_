import { Topbar } from "@/components/app/topbar";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Dashboard" />
      <main className="px-8 pb-8 space-y-5">
        <DashboardView />
      </main>
    </div>
  );
}
