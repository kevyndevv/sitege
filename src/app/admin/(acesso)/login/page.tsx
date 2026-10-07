import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AuthCard } from "@/components/admin/AuthCard";
import { LoginForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const { link } = await searchParams;
  return (
    <AuthCard title="Área da dona">
      {isSupabaseConfigured() ? (
        <LoginForm notice={link === "expirado" ? "O link expirou ou já foi usado. Peça um novo." : undefined} />
      ) : (
        <p className="rounded-2xl bg-alerta-fundo px-4 py-3 text-alerta">
          O banco de dados ainda não foi configurado. Siga as instruções do README.
        </p>
      )}
    </AuthCard>
  );
}
