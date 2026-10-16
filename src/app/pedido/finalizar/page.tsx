import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getDeliveryZones, getSettings } from "@/lib/data/public";
import { todayInSaoPaulo } from "@/lib/format";
import { PauseIcon } from "@/components/icons";
import { CheckoutFlow } from "@/components/site/CheckoutFlow";
import { DEFAULT_CLOSED_MESSAGE } from "@/components/site/ClosedBanner";
import { siteName } from "@/components/site/SiteHeader";
import { SiteShell } from "@/components/site/SiteShell";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Finalizar pedido",
  robots: { index: false },
};

export default async function FinalizarPage() {
  const [{ data: settings, error: settingsError }, catalog, zones] = await Promise.all([
    getSettings(),
    getCatalog(),
    getDeliveryZones(),
  ]);
  const canOrder = settings.accepting_orders && (settings.offers_pickup || settings.offers_delivery);

  return (
    <SiteShell showClosedBanner={false}>
      <div className="container-page pb-20 pt-8 sm:pt-12">
        {settingsError || catalog.error || zones.error ? (
          <div role="alert" className="mx-auto max-w-xl rounded-2xl bg-erro-fundo px-5 py-6 text-erro">
            <p className="font-bold">Não foi possível carregar a página de pedido agora.</p>
            <p className="mt-1">Atualize a página em alguns instantes. Seu carrinho continua guardado.</p>
          </div>
        ) : !canOrder ? (
          <div
            role="status"
            className="faixa-pausa mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[var(--radius-card)] bg-pausa px-6 py-12 text-center text-white shadow-[0_18px_40px_rgb(0_0_0/0.25)]"
          >
            <PauseIcon className="h-14 w-14" />
            <p className="font-display text-3xl">
              {settings.accepting_orders ? "Encomendas em breve" : "Encomendas pausadas"}
            </p>
            <p className="text-lg font-bold">
              {settings.accepting_orders
                ? "As encomendas pelo site abrem em breve."
                : settings.closed_message?.trim() || DEFAULT_CLOSED_MESSAGE}
            </p>
            <Link href="/" className="btn btn-light">
              Voltar para o início
            </Link>
          </div>
        ) : (
          <CheckoutFlow
            products={catalog.data.products}
            categories={catalog.data.categories}
            settings={settings}
            zones={zones.data}
            businessName={siteName(settings)}
            today={todayInSaoPaulo()}
          />
        )}
      </div>
    </SiteShell>
  );
}
