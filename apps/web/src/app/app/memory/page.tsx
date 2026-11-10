import { MemoryPanel } from "@/components/memory-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function MemoryPage() {
  return <MemoryPanel databaseConnected={isSupabaseConfigured()} />;
}
