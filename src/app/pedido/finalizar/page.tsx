import type { Metadata } from "next";
import Link from "next/link";
import { getCatalog, getDeliveryZones, getSettings } from "@/lib/data/public";
import { todayInSaoPaulo } from "@/lib/format";
import { CheckoutFlow } from "@/components/site/CheckoutFlow";
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
    <SiteShell>
      <div className="container-page pb-20 pt-8 sm:pt-12">
        {settingsError || catalog.error || zones.error ? (
          <div role="alert" className="mx-auto max-w-xl rounded-2xl bg-erro-fundo px-5 py-6 text-erro">
            <p className="font-bold">Não foi possível carregar a página de pedido agora.</p>
            <p className="mt-1">Atualize a página em alguns instantes. Seu carrinho continua guardado.</p>
          </div>
        ) : !canOrder ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[var(--radius-card)] bg-alerta-fundo px-6 py-12 text-center text-alerta">
            <p className="font-display text-2xl">
              {settings.accepting_orders
                ? "As encomendas pelo site abrem em breve."
                : settings.closed_message || "No momento não estamos recebendo encomendas pelo site."}
            </p>
            <Link href="/" className="btn btn-primary">
              Voltar para o início
            </Link>
          </div>
        ) : (
          <CheckoutFlow
            products={catalog.data.products}
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
