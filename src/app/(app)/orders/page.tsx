import { Topbar } from "@/components/app/topbar";
import { OrdersView } from "@/components/orders/orders-view";

export default function OrdersPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Siparişler" />
      <main className="px-8 pb-8 space-y-5">
        <OrdersView />
      </main>
    </div>
  );
}

