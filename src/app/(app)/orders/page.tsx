import { Topbar } from "@/components/app/topbar";
import { OrdersView } from "@/components/orders/orders-view";

export default function OrdersPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Siparişler" />
      <main className="px-6 py-6 space-y-6">
        <OrdersView />
      </main>
    </div>
  );
}

