import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { LiveOrderUpdates } from "@/components/admin/LiveOrderUpdates";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: { default: "Painel de encomendas", template: "%s | Painel" },
  robots: { index: false, follow: false },
};

const THEME_BUTTON = "inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // Primeira barreira no servidor (as páginas e ações verificam de novo, e o banco aplica RLS).
  const { user } = await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col bg-acucar">
      <header className="bg-ameixa text-white">
        <div className="container-page flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <Link href="/admin" className="font-display text-xl">
              Painel de encomendas
            </Link>
            <div className="flex items-center gap-1 sm:hidden">
            <ThemeToggle className={THEME_BUTTON} />
            <form action={signOut}>
              <button type="submit" className="btn btn-sm border border-white/40 text-white hover:bg-white/10">
                Sair
              </button>
            </form>
            </div>
          </div>
          <AdminNav />
          <div className="hidden items-center gap-2 sm:flex">
            <ThemeToggle className={THEME_BUTTON} />
            <Link href="/" className="btn btn-sm text-white hover:bg-white/10" target="_blank">
              Ver site
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="btn btn-sm border border-white/40 text-white hover:bg-white/10"
                title={user.email ?? undefined}
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="scallop" aria-hidden="true" />
      <main id="conteudo" className="container-page flex-1 pb-16 pt-6 sm:pt-8">
        {children}
      </main>
      <LiveOrderUpdates />
    </div>
  );
}
