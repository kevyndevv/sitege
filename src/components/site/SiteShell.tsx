import { getSettings } from "@/lib/data/public";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/** Cabeçalho + conteúdo + rodapé das páginas públicas. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const { data: settings, error } = await getSettings();
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-glace focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <SiteHeader settings={settings} />
      {error === "not_configured" ? (
        <div className="bg-alerta-fundo text-alerta">
          <p className="container-page py-3 text-sm font-bold">
            Site em configuração: o banco de dados ainda não foi conectado (veja o README).
          </p>
        </div>
      ) : null}
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
