import { SettingsPanel } from "@/components/settings-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SettingsPage() {
  return <SettingsPanel databaseConnected={isSupabaseConfigured()} />;
}
