import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/AuthCard";
import { ResetRequestForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false, follow: false } };

export default function EsqueciSenhaPage() {
  return (
    <AuthCard title="Criar nova senha">
      <ResetRequestForm />
    </AuthCard>
  );
}
