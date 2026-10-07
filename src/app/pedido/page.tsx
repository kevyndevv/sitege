import type { Metadata } from "next";
import { getCatalog, getSettings } from "@/lib/data/public";
import { FormaPlaceholder } from "@/components/site/ProductImage";
import { CatalogView } from "@/components/site/CatalogView";
import { SiteShell } from "@/components/site/SiteShell";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Cardápio e pedido",
  description: "Escolha os doces e salgados e faça sua encomenda pelo site, sem precisar criar conta.",
};

export default async function PedidoPage() {
  const [{ data: settings }, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const { products, categories } = catalog.data;
  const canOrder = settings.accepting_orders && (settings.offers_pickup || settings.offers_delivery);

  return (
    <SiteShell>
      <div className="container-page pb-32 pt-8 sm:pt-12">
        <h1 className="font-display text-4xl text-calda sm:text-5xl">Cardápio</h1>
        <p className="mt-2 max-w-2xl text-lg text-suave">
          Toque em <strong className="text-calda">Adicionar ao pedido</strong> nos produtos que quiser. Depois é só revisar e
          informar seus dados — não precisa criar conta.
        </p>

        {!settings.accepting_orders ? (
          <p role="status" className="mt-6 rounded-2xl bg-alerta-fundo px-5 py-4 font-bold text-alerta">
            {settings.closed_message || "No momento não estamos recebendo encomendas pelo site."}
          </p>
        ) : !canOrder ? (
          <p role="status" className="mt-6 rounded-2xl bg-alerta-fundo px-5 py-4 font-bold text-alerta">
            As encomendas pelo site abrem em breve.
          </p>
        ) : null}

        <div className="mt-8">
          {catalog.error === "unavailable" ? (
            <div role="alert" className="rounded-2xl bg-erro-fundo px-5 py-6 text-erro">
              <p className="font-bold">Não foi possível carregar o cardápio agora.</p>
              <p className="mt-1">Atualize a página em alguns instantes.</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-14 text-center">
              <FormaPlaceholder className="h-14 w-auto text-ameixa-clara" />
              <p className="font-display text-2xl text-tinta">O cardápio está sendo preparado.</p>
              <p className="text-suave">Volte em breve para ver as delícias disponíveis.</p>
            </div>
          ) : (
            <CatalogView products={products} categories={categories} canOrder={canOrder} />
          )}
        </div>
      </div>
    </SiteShell>
  );
}
