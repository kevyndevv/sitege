import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSettings } from "@/lib/types";

export const SETTINGS_COLUMNS =
  "business_name, hero_title, hero_text, about_text, logo_path, hero_image_path, instagram_handle, whatsapp_number, contact_email, city, opening_hours, accepting_orders, closed_message, offers_pickup, offers_delivery, pickup_info, delivery_info, delivery_fee_cents, min_lead_days, order_notice";

/**
 * Lê a linha de configurações. Se o banco ainda não recebeu a migração
 * 20261016000000 (coluna hero_frame inexistente, erro 42703), o site continua
 * funcionando com a moldura padrão.
 */
export async function selectBusinessSettings(client: SupabaseClient) {
  const full = await client
    .from("business_settings")
    .select(`${SETTINGS_COLUMNS}, hero_frame`)
    .maybeSingle<BusinessSettings>();
  if (full.error?.code !== "42703") return { data: full.data, error: full.error };

  console.warn("[settings] rode a migração 20261016000000_moldura_da_foto.sql no Supabase");
  const basic = await client
    .from("business_settings")
    .select(SETTINGS_COLUMNS)
    .maybeSingle<Omit<BusinessSettings, "hero_frame">>();
  return {
    data: basic.data ? ({ ...basic.data, hero_frame: null } as BusinessSettings) : null,
    error: basic.error,
  };
}
