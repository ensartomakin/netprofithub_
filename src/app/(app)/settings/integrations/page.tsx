import { Topbar } from "@/components/app/topbar";
import { IntegrationsView } from "@/components/settings/integrations-view";

export default function IntegrationsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Entegrasyonlar" />
      <main className="px-8 pb-8">
        <IntegrationsView />
      </main>
    </div>
  );
}

