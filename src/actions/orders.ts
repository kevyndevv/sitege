"use server";

import { getCatalog, getDeliveryZones, getSettings } from "@/lib/data/public";
import { orderLeadTime } from "@/lib/lead-time";
import { onlyDigits } from "@/lib/format";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPublicClient } from "@/lib/supabase/public";
import type { TrackedOrder } from "@/lib/types";
import {
  isUuid,
  normalizeName,
  orderErrorMessage,
  validateCheckout,
  type CheckoutInput,
  type FieldErrors,
} from "@/lib/validation";

export type CreateOrderResult =
  | { ok: true; orderNumber: string; totalCents: number }
  | { ok: false; code: string; message: string; fieldErrors?: FieldErrors };

const KNOWN_DB_ERRORS = /^(ORDERS_CLOSED|PRODUCT_UNAVAILABLE|FULFILLMENT_UNAVAILABLE|INVALID_[A-Z]+|DAILY_LIMIT|WEEKLY_LIMIT|RATE_LIMITED|DUPLICATE_ORDER|TRY_AGAIN)$/;

/**
 * Registra uma encomenda. Fluxo de segurança:
 *  1. Campo-armadilha e limite por IP (robôs).
 *  2. Validação completa no servidor (mesmas regras do formulário).
 *  3. Somente os campos esperados são repassados (nada de "mass assignment").
 *  4. O banco (create_order) valida de novo, calcula preços/totais com o
 *     catálogo oficial, aplica os limites por cliente e grava tudo numa transação.
 * O site só mostra "pedido registrado" quando o banco confirma.
 */
export async function createOrder(raw: unknown): Promise<CreateOrderResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, code: "NOT_CONFIGURED", message: orderErrorMessage(undefined) };
  }

  const input = sanitizeInput(raw);
  if (!input) return { ok: false, code: "VALIDATION", message: "Não foi possível ler o pedido. Recarregue a página." };

  // Robôs costumam preencher todos os campos, inclusive os invisíveis.
  if (input.website) {
    return { ok: false, code: "VALIDATION", message: "Não foi possível registrar o pedido." };
  }

  const ip = await clientIp();
  if (hitRateLimit(`order:${ip}`, 8, 60 * 60 * 1000)) {
    return { ok: false, code: "RATE_LIMITED", message: orderErrorMessage("RATE_LIMITED") };
  }

  const settings = await getSettings();
  if (settings.error) {
    return { ok: false, code: "UNAVAILABLE", message: orderErrorMessage(undefined) };
  }
  const s = settings.data;
  if (!s.accepting_orders) {
    return { ok: false, code: "ORDERS_CLOSED", message: s.closed_message || orderErrorMessage("ORDERS_CLOSED") };
  }

  const [zones, catalog] = await Promise.all([getDeliveryZones(), getCatalog()]);
  if (zones.error || catalog.error) {
    return { ok: false, code: "UNAVAILABLE", message: orderErrorMessage(undefined) };
  }
  // Antecedência deste pedido: a maior entre a geral e a das categorias dos itens.
  const lead = orderLeadTime(
    s.min_lead_days,
    input.items.map((item) => item.productId),
    catalog.data.products,
    catalog.data.categories,
  );
  const fieldErrors = validateCheckout(input, {
    offersPickup: s.offers_pickup,
    offersDelivery: s.offers_delivery,
    minLeadDays: lead.days,
    leadCategories: lead.categories,
    zoneIds: zones.data.map((z) => z.id),
  });
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, code: "VALIDATION", message: "Confira os campos destacados.", fieldErrors };
  }

  const { data, error } = await getPublicClient().rpc("create_order", {
    p_idempotency_key: input.idempotencyKey,
    p_customer_name: normalizeName(input.customerName),
    p_customer_phone: onlyDigits(input.customerPhone),
    p_fulfillment_type: input.fulfillmentType,
    p_delivery_address: input.fulfillmentType === "delivery" ? input.deliveryAddress.trim() : null,
    p_requested_date: input.requestedDate,
    p_requested_time: input.requestedTime || null,
    p_notes: input.notes.trim() || null,
    p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_delivery_zone_id: input.fulfillmentType === "delivery" && isUuid(input.deliveryZoneId) ? input.deliveryZoneId : null,
  });

  if (error) {
    const code = KNOWN_DB_ERRORS.test(error.message) ? error.message : "UNKNOWN";
    if (code === "UNKNOWN") {
      // Sem dados pessoais no log: só o código técnico do erro.
      console.error("[createOrder] erro inesperado do banco:", error.code);
    }
    return { ok: false, code, message: orderErrorMessage(code) };
  }

  const result = data as { order_number?: unknown; total_cents?: unknown } | null;
  if (!result || typeof result.order_number !== "string" || typeof result.total_cents !== "number") {
    console.error("[createOrder] resposta inesperada do banco");
    return { ok: false, code: "UNKNOWN", message: orderErrorMessage(undefined) };
  }

  return { ok: true, orderNumber: result.order_number, totalCents: result.total_cents };
}

/** Aceita apenas os campos conhecidos, com tipos e tamanhos limitados. */
function sanitizeInput(raw: unknown): CheckoutInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

  if (!isUuid(r.idempotencyKey)) return null;
  if (!Array.isArray(r.items) || r.items.length > 60) return null;

  const items: CheckoutInput["items"] = [];
  for (const item of r.items) {
    if (!item || typeof item !== "object") return null;
    const { productId, quantity } = item as Record<string, unknown>;
    if (typeof productId !== "string" || typeof quantity !== "number") return null;
    items.push({ productId, quantity });
  }

  const fulfillment = r.fulfillmentType === "pickup" || r.fulfillmentType === "delivery" ? r.fulfillmentType : "";

  return {
    idempotencyKey: r.idempotencyKey,
    customerName: str(r.customerName, 200),
    customerPhone: str(r.customerPhone, 40),
    fulfillmentType: fulfillment,
    deliveryZoneId: str(r.deliveryZoneId, 36),
    deliveryAddress: str(r.deliveryAddress, 600),
    requestedDate: str(r.requestedDate, 10),
    requestedTime: str(r.requestedTime, 5),
    notes: str(r.notes, 1000),
    items,
    website: str(r.website, 200),
  };
}

/**
 * Janela do limite de consultas (20 consultas por janela, por IP).
 * Em testes no computador (npm run dev): 30 segundos.
 * No site publicado (npm run build / start): 10 minutos.
 */
const TRACK_WINDOW_MS = process.env.NODE_ENV === "production" ? 10 * 60 * 1000 : 30 * 1000;

export type TrackOrdersResult =
  | { ok: true; orders: TrackedOrder[] }
  | { ok: false; message: string };

/**
 * Consulta dos pedidos pelo telefone usado na encomenda (últimos 60 dias).
 * A resposta traz só situação, datas, itens e valores — nunca nome, telefone,
 * endereço ou observações. Limitada por IP para dificultar varreduras.
 */
export async function trackOrdersByPhone(phone: unknown): Promise<TrackOrdersResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "A consulta ainda não está disponível." };
  const digits = typeof phone === "string" ? onlyDigits(phone).slice(0, 13) : "";
  if (digits.length < 10) {
    return { ok: false, message: "Informe o telefone com DDD, do mesmo jeito que você usou no pedido." };
  }

  const ip = await clientIp();
  if (hitRateLimit(`track:${ip}`, 20, TRACK_WINDOW_MS)) {
    return { ok: false, message: "Muitas consultas seguidas. Aguarde um pouco e tente de novo." };
  }

  const { data, error } = await getPublicClient().rpc("get_orders_by_phone", { p_phone: digits });
  if (error) {
    console.error("[trackOrdersByPhone] erro do banco:", error.code || error.message);
    return { ok: false, message: "Não foi possível consultar agora. Tente novamente em instantes." };
  }
  return { ok: true, orders: (Array.isArray(data) ? data : []) as TrackedOrder[] };
}
