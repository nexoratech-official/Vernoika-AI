import { ChatPanel } from "@/components/chat-panel";
import { LiveChatPanel } from "@/components/live-chat-panel";
import { isModelGatewayConfigured } from "@/lib/intelligence/model-gateway";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ChatPage() {
  return isSupabaseConfigured()
    ? <LiveChatPanel aiConfigured={isModelGatewayConfigured()} />
    : <ChatPanel />;
}
