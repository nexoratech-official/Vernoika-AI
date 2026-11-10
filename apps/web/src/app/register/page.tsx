import { AuthForm } from "@/components/auth-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function RegisterPage() {
  return <AuthForm mode="register" authConfigured={isSupabaseConfigured()} />;
}
