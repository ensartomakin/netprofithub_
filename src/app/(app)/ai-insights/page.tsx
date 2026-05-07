import { Topbar } from "@/components/app/topbar";
import { AiInsightsView } from "@/components/ai/ai-insights-view";

export default function AiInsightsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="AI İçgörüler" />
      <main className="px-8 pb-8 space-y-5">
        <AiInsightsView />
      </main>
    </div>
  );
}
