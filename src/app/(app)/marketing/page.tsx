import { Topbar } from "@/components/app/topbar";
import { MarketingView } from "@/components/marketing/marketing-view";

export default function MarketingPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Pazarlama" />
      <main className="px-6 py-6">
        <MarketingView />
      </main>
    </div>
  );
}
