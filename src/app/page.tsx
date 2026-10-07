import Image from "next/image";
import Link from "next/link";
import { getCatalog, getPopularProducts, getSettings } from "@/lib/data/public";
import { publicImageUrl } from "@/lib/supabase/config";
import { FormaPlaceholder } from "@/components/site/ProductImage";
import { ProductCard } from "@/components/site/ProductCard";
import { SiteShell } from "@/components/site/SiteShell";

// A página é gerada no servidor e reaproveitada por até 60 s (ISR). Alterações
// feitas no painel invalidam o cache na hora (revalidatePath).
export const revalidate = 60;

export default async function HomePage() {
  const [{ data: settings }, popular, catalog] = await Promise.all([
    getSettings(),
    getPopularProducts(),
    getCatalog(),
  ]);

  const heroImage = publicImageUrl(settings.hero_image_path);
  const canOrder = settings.accepting_orders && (settings.offers_pickup || settings.offers_delivery);
  const title = settings.hero_title?.trim() || "Doces e salgados feitos em casa, sob encomenda";
  const text =
    settings.hero_text?.trim() ||
    "Escolha o que você quer, diga a data da sua festa ou do seu café, e a gente prepara com carinho.";
  const hasProducts = catalog.data.products.length > 0;

  return (
    <SiteShell>
      {/* Apresentação */}
      <section aria-labelledby="titulo-principal" className="bg-ameixa text-white">
        <div className="container-page grid items-center gap-10 pb-12 pt-10 md:grid-cols-[1.15fr_1fr] md:pb-16 md:pt-16">
          <div>
            <h1 id="titulo-principal" className="font-display text-[2.15rem] leading-[1.1] sm:text-5xl lg:text-[3.6rem]">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90 sm:text-xl">{text}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/pedido" className="btn btn-light min-h-14 px-8 text-lg">
                Fazer pedido
              </Link>
              <Link href="/acompanhar" className="btn min-h-14 border-2 border-white/50 text-white hover:bg-white/10">
                Acompanhar meu pedido
              </Link>
            </div>
            {!settings.accepting_orders && settings.closed_message ? (
              <p className="mt-6 max-w-xl rounded-2xl bg-white/12 px-4 py-3 text-white">{settings.closed_message}</p>
            ) : null}
          </div>

          <div className="mx-auto w-full max-w-sm md:max-w-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-full border-[6px] border-white/25 bg-ameixa-funda">
              {heroImage ? (
                <Image
                  src={heroImage}
                  alt={`Encomendas de ${settings.business_name?.trim() || "doces e salgados"}`}
                  fill
                  priority
                  sizes="(min-width: 768px) 28rem, 90vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <FormaPlaceholder className="h-32 w-auto text-white/60" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="scallop" aria-hidden="true" />

      {/* Mais pedidos */}
      <section aria-labelledby="titulo-queridinhos" className="container-page py-14 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="titulo-queridinhos" className="font-display text-3xl text-calda sm:text-4xl">
              Os queridinhos da casa
            </h2>
            <p className="mt-2 max-w-xl text-suave">Os produtos que mais saem nas encomendas confirmadas.</p>
          </div>
          {hasProducts ? (
            <Link href="/pedido" className="btn btn-outline btn-sm">
              Ver cardápio completo
            </Link>
          ) : null}
        </div>

        {popular.data.length > 0 ? (
          <ul
            className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
            aria-label="Produtos mais pedidos"
          >
            {popular.data.map((product, index) => (
              <li key={product.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
                <ProductCard product={product} priority={index < 2} canOrder={canOrder} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-12 text-center">
            <FormaPlaceholder className="h-14 w-auto text-ameixa-clara" />
            <p className="font-display text-2xl text-tinta">
              Em breve, você poderá conhecer os nossos queridinhos por aqui!
            </p>
            {hasProducts ? (
              <Link href="/pedido" className="btn btn-primary">
                Ver o cardápio
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {/* Como funciona: é de fato uma sequência, por isso os números */}
      <section aria-labelledby="titulo-como-funciona" className="bg-veu">
        <div className="container-page py-14 sm:py-16">
          <h2 id="titulo-como-funciona" className="font-display text-3xl text-calda sm:text-4xl">
            Como fazer sua encomenda
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Escolha os produtos", "Veja o cardápio e adicione ao pedido o que quiser, na quantidade que precisar."],
              ["Diga quando precisa", "Informe a data, o horário e se prefere retirar ou receber em casa (quando disponível)."],
              ["Acompanhe pelo site", "Você recebe um código para ver quando o pedido for confirmado, preparado e estiver pronto."],
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ameixa text-xl text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-calda">{titulo}</h3>
                  <p className="mt-1 text-suave">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link href="/pedido" className="btn btn-primary mt-10">
            Fazer pedido
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
