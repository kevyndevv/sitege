import { PauseIcon } from "@/components/icons";

export const DEFAULT_CLOSED_MESSAGE = "No momento não estamos recebendo encomendas pelo site.";

/**
 * Faixa vermelha presa logo abaixo do menu, em todas as páginas públicas,
 * enquanto a dona deixar as encomendas pausadas no painel. Acompanha a
 * rolagem da página (fica dentro do StickyTop).
 */
export function ClosedBanner({ message }: { message: string | null }) {
  return (
    <div role="status" className="faixa-pausa bg-pausa text-white shadow-[0_6px_16px_rgb(0_0_0/0.2)]">
      <div className="container-page flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3">
        <PauseIcon className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        <p className="min-w-0 leading-snug">
          <strong className="font-display mr-2 text-lg sm:text-xl">Encomendas pausadas.</strong>
          <span className="font-bold sm:text-lg">{message?.trim() || DEFAULT_CLOSED_MESSAGE}</span>
        </p>
      </div>
    </div>
  );
}
