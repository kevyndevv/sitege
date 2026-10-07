import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/admin/AuthCard";
import { NewPasswordForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false } };

export default async function NovaSenhaPage() {
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?link=expirado");
  return (
    <AuthCard title="Escolha uma nova senha">
      <NewPasswordForm />
    </AuthCard>
  );
}
