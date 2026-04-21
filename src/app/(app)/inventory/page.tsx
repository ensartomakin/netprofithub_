import { Topbar } from "@/components/app/topbar";
import { InventoryView } from "@/components/inventory/inventory-view";

export default function InventoryPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Envanter" />
      <main className="px-6 py-6 space-y-6">
        <InventoryView />
      </main>
    </div>
  );
}
