import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicClient } from "@/lib/supabase/public";
import type { BusinessSettings, CatalogProduct, Category, DeliveryZone } from "@/lib/types";

export type Loaded<T> = { data: T; error: null } | { data: T; error: "not_configured" | "unavailable" };

export const EMPTY_SETTINGS: BusinessSettings = {
  business_name: null,
  hero_title: null,
  hero_text: null,
  about_text: null,
  logo_path: null,
  hero_image_path: null,
  instagram_handle: null,
  whatsapp_number: null,
  contact_email: null,
  city: null,
  opening_hours: null,
  accepting_orders: false,
  closed_message: null,
  offers_pickup: false,
  offers_delivery: false,
  pickup_info: null,
  delivery_info: null,
  delivery_fee_cents: null,
  min_lead_days: null,
  order_notice: null,
};

const SETTINGS_COLUMNS =
  "business_name, hero_title, hero_text, about_text, logo_path, hero_image_path, instagram_handle, whatsapp_number, contact_email, city, opening_hours, accepting_orders, closed_message, offers_pickup, offers_delivery, pickup_info, delivery_info, delivery_fee_cents, min_lead_days, order_notice";

const PRODUCT_COLUMNS = "id, name, description, price_cents, unit_label, image_path, category_id";

/** Número máximo de produtos na seção "mais pedidos" da página inicial. */
export const POPULAR_LIMIT = 6;

export const getSettings = cache(async (): Promise<Loaded<BusinessSettings>> => {
  if (!isSupabaseConfigured()) return { data: EMPTY_SETTINGS, error: "not_configured" };
  const { data, error } = await getPublicClient()
    .from("business_settings")
    .select(SETTINGS_COLUMNS)
    .maybeSingle<BusinessSettings>();
  if (error || !data) {
    console.error("[settings] falha ao carregar configurações:", error ? error.code || error.message : "sem linha");
    return { data: EMPTY_SETTINGS, error: "unavailable" };
  }
  return { data, error: null };
});

/**
 * Categorias com a antecedência de cada uma. Se o banco ainda não recebeu a
 * migração 20261008000000 (coluna min_lead_days inexistente, erro 42703), o
 * cardápio continua funcionando sem a antecedência por categoria.
 */
async function loadCategories(supabase: ReturnType<typeof getPublicClient>) {
  const withLead = await supabase
    .from("categories")
    .select("id, name, sort_order, min_lead_days")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<Category[]>();
  if (withLead.error?.code !== "42703") return withLead;

  console.warn("[catalog] rode a migração 20261008000000_antecedencia_por_categoria.sql no Supabase");
  const basic = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<Omit<Category, "min_lead_days">[]>();
  return { error: basic.error, data: (basic.data ?? []).map((c) => ({ ...c, min_lead_days: null })) };
}

export const getCatalog = cache(
  async (): Promise<Loaded<{ products: CatalogProduct[]; categories: Category[] }>> => {
    const empty = { products: [], categories: [] };
    if (!isSupabaseConfigured()) return { data: empty, error: "not_configured" };
    const supabase = getPublicClient();
    // A RLS já devolve somente produtos ativos e não arquivados para o público;
    // o filtro explícito deixa a intenção clara e usa o índice parcial.
    const [products, categories] = await Promise.all([
      supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("active", true)
        .eq("archived", false)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .returns<CatalogProduct[]>(),
      loadCategories(supabase),
    ]);
    if (products.error || categories.error) {
      const e = products.error ?? categories.error;
      console.error("[catalog] falha ao carregar catálogo:", e?.code || e?.message);
      return { data: empty, error: "unavailable" };
    }
    return { data: { products: products.data ?? [], categories: categories.data ?? [] }, error: null };
  },
);

export type PopularProduct = Omit<CatalogProduct, "category_id"> & { rank: number };

export const getPopularProducts = cache(async (): Promise<Loaded<PopularProduct[]>> => {
  if (!isSupabaseConfigured()) return { data: [], error: "not_configured" };
  const { data, error } = await getPublicClient().rpc("get_popular_products", { p_limit: POPULAR_LIMIT });
  if (error) {
    console.error("[popular] falha ao calcular mais pedidos:", error.code || error.message);
    return { data: [], error: "unavailable" };
  }
  return { data: (data ?? []) as PopularProduct[], error: null };
});

/** Locais de entrega ativos, cada um com sua taxa (a RLS só devolve os ativos). */
export const getDeliveryZones = cache(async (): Promise<Loaded<DeliveryZone[]>> => {
  if (!isSupabaseConfigured()) return { data: [], error: "not_configured" };
  const { data, error } = await getPublicClient()
    .from("delivery_zones")
    .select("id, name, fee_cents")
    .eq("active", true)
    .order("sort_order")
    .order("name")
    .returns<DeliveryZone[]>();
  if (error) {
    console.error("[zones] falha ao carregar locais de entrega:", error.code || error.message);
    return { data: [], error: "unavailable" };
  }
  return { data: data ?? [], error: null };
});
