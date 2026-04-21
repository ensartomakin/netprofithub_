import { Topbar } from "@/components/app/topbar";
import { AiInsightsView } from "@/components/ai/ai-insights-view";

export default function AiInsightsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="AI İçgörüler" />
      <main className="px-6 py-6 space-y-6">
        <AiInsightsView />
      </main>
    </div>
  );
}
