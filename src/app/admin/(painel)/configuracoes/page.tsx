import { requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/supabase/config";
import type { AdminDeliveryZone, BusinessSettings } from "@/lib/types";
import { ZoneManager } from "@/components/admin/ZoneManager";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const { supabase } = await requireAdmin();
  const zonesRes = await supabase
    .from("delivery_zones")
    .select("id, name, fee_cents, active, sort_order")
    .order("sort_order")
    .order("name")
    .returns<AdminDeliveryZone[]>();
  const { data: settings, error } = await supabase
    .from("business_settings")
    .select(
      "business_name, hero_title, hero_text, about_text, logo_path, hero_image_path, instagram_handle, whatsapp_number, contact_email, city, opening_hours, accepting_orders, closed_message, offers_pickup, offers_delivery, pickup_info, delivery_info, delivery_fee_cents, min_lead_days, order_notice",
    )
    .maybeSingle<BusinessSettings>();

  if (error || !settings) {
    return (
      <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
        Não foi possível carregar as configurações. Atualize a página.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Configurações</h1>
        <p className="mt-2 text-suave">Tudo o que aparece no site pode ser mudado aqui, sem mexer em código.</p>
      </div>
      <section aria-labelledby="locais" className="card space-y-4 p-5 sm:p-6">
        <h2 id="locais" className="font-display text-2xl">
          Locais de entrega e taxas
        </h2>
        <ZoneManager zones={zonesRes.data ?? []} />
      </section>
      <SettingsForm
        settings={settings}
        logoUrl={publicImageUrl(settings.logo_path)}
        heroUrl={publicImageUrl(settings.hero_image_path)}
      />
    </div>
  );
}
