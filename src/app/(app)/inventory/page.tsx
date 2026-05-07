import { Topbar } from "@/components/app/topbar";
import { InventoryView } from "@/components/inventory/inventory-view";

export default function InventoryPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Envanter" />
      <main className="px-8 pb-8 space-y-5">
        <InventoryView />
      </main>
    </div>
  );
}
