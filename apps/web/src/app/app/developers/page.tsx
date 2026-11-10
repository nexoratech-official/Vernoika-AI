import { DeveloperPanel } from "@/components/developer-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function DevelopersPage() {
  return <DeveloperPanel databaseConnected={isSupabaseConfigured()} />;
}
