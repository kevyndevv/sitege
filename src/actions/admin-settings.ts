"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { onlyDigits } from "@/lib/format";
import { readImageUpload } from "@/lib/image-upload";
import { revalidatePublicPages } from "@/lib/revalidate";
import { IMAGES_BUCKET } from "@/lib/supabase/config";

export type SettingsField =
  | "business_name"
  | "hero_title"
  | "hero_text"
  | "about_text"
  | "instagram_handle"
  | "whatsapp_number"
  | "contact_email"
  | "city"
  | "opening_hours"
  | "closed_message"
  | "pickup_info"
  | "delivery_info"
  | "min_lead_days"
  | "order_notice"
  | "offers"
  | "logo"
  | "hero_image";

export type SettingsResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<SettingsField, string>>;
} | null;

const TEXT_LIMITS = {
  business_name: 80,
  hero_title: 120,
  hero_text: 600,
  about_text: 1200,
  city: 120,
  opening_hours: 300,
  closed_message: 300,
  pickup_info: 400,
  delivery_info: 400,
  order_notice: 400,
} as const;

type TextField = keyof typeof TEXT_LIMITS;

/** Aceita "@perfil", "perfil" ou o link do perfil. */
function parseInstagram(value: string): string | null | "invalid" {
  const v = value.trim();
  if (!v) return null;
  const fromUrl = v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i)?.[1];
  const handle = (fromUrl ?? v).replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : "invalid";
}

/**
 * Salva as configurações do negócio. Só os campos listados aqui são aceitos
 * (o banco também limita, por coluna, o que a dona pode alterar).
 */
export async function saveSettings(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  let session;
  try {
    session = await assertAdmin();
  } catch {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  const errors: NonNullable<SettingsResult>["fieldErrors"] = {};
  const values: Record<string, string | number | boolean | null> = {};

  for (const [field, max] of Object.entries(TEXT_LIMITS) as [TextField, number][]) {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > max) errors[field] = `Use no máximo ${max} caracteres.`;
    values[field] = value || null;
  }

  const instagram = parseInstagram(String(formData.get("instagram_handle") ?? ""));
  if (instagram === "invalid") errors.instagram_handle = "Informe só o nome do perfil, ex.: @docesdavovo";
  else values.instagram_handle = instagram;

  const whatsappRaw = String(formData.get("whatsapp_number") ?? "").trim();
  const whatsapp = onlyDigits(whatsappRaw);
  if (whatsappRaw && (whatsapp.length < 10 || whatsapp.length > 13)) {
    errors.whatsapp_number = "Informe o número com DDD, ex.: (11) 98888-7777";
  }
  values.whatsapp_number = whatsapp || null;

  const email = String(formData.get("contact_email") ?? "").trim();
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.contact_email = "E-mail inválido.";
  }
  values.contact_email = email || null;

  values.accepting_orders = formData.get("accepting_orders") === "on";
  values.offers_pickup = formData.get("offers_pickup") === "on";
  values.offers_delivery = formData.get("offers_delivery") === "on";

  // A taxa de entrega agora vem só dos "Locais de entrega". A antiga taxa única
  // foi retirada do painel; zeramos o valor para não ficar uma taxa escondida
  // valendo quando não houver locais ativos (nesse caso fica "a combinar").
  values.delivery_fee_cents = null;

  const leadRaw = String(formData.get("min_lead_days") ?? "").trim();
  if (leadRaw) {
    const lead = Number(leadRaw);
    if (!Number.isInteger(lead) || lead < 0 || lead > 60) errors.min_lead_days = "Informe um número de 0 a 60.";
    values.min_lead_days = Number.isInteger(lead) ? lead : null;
  } else {
    values.min_lead_days = null;
  }

  const logo = await readImageUpload(formData.get("logo"));
  if (logo.error) errors.logo = logo.error;
  const hero = await readImageUpload(formData.get("hero_image"));
  if (hero.error) errors.hero_image = hero.error;

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Confira os campos destacados.", fieldErrors: errors };
  }

  const { data: current } = await session.supabase
    .from("business_settings")
    .select("logo_path, hero_image_path")
    .maybeSingle();

  const toRemove: string[] = [];
  const uploaded: string[] = [];

  for (const [key, upload, removeFlag, column] of [
    ["logo", logo, "remove_logo", "logo_path"],
    ["hero_image", hero, "remove_hero_image", "hero_image_path"],
  ] as const) {
    const previous = (current?.[column] as string | null | undefined) ?? null;
    if (upload.file) {
      const path = `site/${key}-${randomUUID()}.${upload.file.ext}`;
      const { error } = await session.supabase.storage.from(IMAGES_BUCKET).upload(path, upload.file.bytes, {
        contentType: upload.file.mime,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        if (uploaded.length) await session.supabase.storage.from(IMAGES_BUCKET).remove(uploaded);
        return { ok: false, message: "Não foi possível enviar a imagem. Tente novamente." };
      }
      uploaded.push(path);
      values[column] = path;
      if (previous) toRemove.push(previous);
    } else if (formData.get(removeFlag) === "1") {
      values[column] = null;
      if (previous) toRemove.push(previous);
    }
  }

  const { error } = await session.supabase.from("business_settings").update(values).eq("id", true);
  if (error) {
    console.error("[saveSettings] falha:", error.code);
    if (uploaded.length) await session.supabase.storage.from(IMAGES_BUCKET).remove(uploaded);
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
  if (toRemove.length) await session.supabase.storage.from(IMAGES_BUCKET).remove(toRemove);

  revalidatePath("/admin", "layout");
  revalidatePublicPages();
  return { ok: true, message: "Configurações salvas! O site já foi atualizado." };
}
