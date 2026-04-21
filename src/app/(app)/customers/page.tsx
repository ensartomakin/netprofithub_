import { Topbar } from "@/components/app/topbar";
import { CustomerAnalyticsView } from "@/components/customers/customer-analytics-view";

export default function CustomersPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Müşteri Analitiği" />
      <main className="px-6 py-6 space-y-6">
        <CustomerAnalyticsView />
      </main>
    </div>
  );
}

