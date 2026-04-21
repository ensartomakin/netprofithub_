import { Topbar } from "@/components/app/topbar";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <div className="min-h-full">
      <Topbar title="Ayarlar" />
      <main className="px-6 py-6 space-y-6">
        <SettingsView />
      </main>
    </div>
  );
}

