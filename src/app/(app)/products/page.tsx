import { Topbar } from "@/components/app/topbar";
import { ProductsView } from "@/components/products/products-view";

export default function ProductsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Ürünler" />
      <main className="px-6 py-6">
        <ProductsView />
      </main>
    </div>
  );
}
