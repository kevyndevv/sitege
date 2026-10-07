import type { Metadata } from "next";
import { getSettings } from "@/lib/data/public";
import { siteName } from "@/components/site/SiteHeader";
import { SiteShell } from "@/components/site/SiteShell";
import { TrackOrder } from "@/components/site/TrackOrder";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  description: "Veja a situação das suas encomendas usando o telefone informado no pedido.",
  robots: { index: false, follow: false },
};

export default async function AcompanharPage() {
  const { data: settings } = await getSettings();
  return (
    <SiteShell>
      <div className="container-page pb-20 pt-8 sm:pt-12">
        <h1 className="font-display text-4xl text-calda sm:text-5xl">Acompanhar pedido</h1>
        <p className="mb-8 mt-2 max-w-2xl text-lg text-suave">
          Digite o telefone que você usou ao fazer a encomenda para ver em que etapa ela está.
        </p>
        <TrackOrder
          businessName={siteName(settings)}
          whatsapp={settings.whatsapp_number}
          pickupInfo={settings.pickup_info}
        />
      </div>
    </SiteShell>
  );
}
