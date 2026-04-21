import { Topbar } from "@/components/app/topbar";
import { ReturnsView } from "@/components/returns/returns-view";

export default function ReturnsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="İadeler" />
      <main className="px-6 py-6 space-y-6">
        <ReturnsView />
      </main>
    </div>
  );
}

