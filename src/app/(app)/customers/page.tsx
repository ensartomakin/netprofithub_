import { Topbar } from "@/components/app/topbar";
import { CustomerAnalyticsView } from "@/components/customers/customer-analytics-view";

export default function CustomersPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Müşteri Analitiği" />
      <main className="px-8 pb-8 space-y-5">
        <CustomerAnalyticsView />
      </main>
    </div>
  );
}

