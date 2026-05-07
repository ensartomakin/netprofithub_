import { Topbar } from "@/components/app/topbar";
import { ReturnsView } from "@/components/returns/returns-view";

export default function ReturnsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="İadeler" />
      <main className="px-8 pb-8 space-y-5">
        <ReturnsView />
      </main>
    </div>
  );
}

