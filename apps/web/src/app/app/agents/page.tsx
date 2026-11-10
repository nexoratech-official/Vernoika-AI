import { AgentsPanel } from "@/components/agents-panel";
import { isModelGatewayConfigured } from "@/lib/intelligence/model-gateway";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function AgentsPage() {
  const databaseConnected = isSupabaseConfigured();
  return (
    <AgentsPanel
      databaseConnected={databaseConnected}
      aiConfigured={databaseConnected && isModelGatewayConfigured()}
    />
  );
}
