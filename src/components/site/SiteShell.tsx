import { getSettings } from "@/lib/data/public";
import { ClosedBanner } from "./ClosedBanner";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StickyTop } from "./StickyTop";

/**
 * Cabeçalho + conteúdo + rodapé das páginas públicas.
 * Com as encomendas pausadas no painel, mostra a faixa de aviso em destaque
 * (a página de finalizar já mostra o aviso no lugar do formulário).
 */
export async function SiteShell({
  children,
  showClosedBanner = true,
}: {
  children: React.ReactNode;
  showClosedBanner?: boolean;
}) {
  const { data: settings, error } = await getSettings();
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-glace focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <StickyTop>
        <SiteHeader settings={settings} />
        {showClosedBanner && !error && !settings.accepting_orders ? (
          <ClosedBanner message={settings.closed_message} />
        ) : null}
      </StickyTop>
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
