/**
 * Validações compartilhadas entre o navegador (feedback imediato) e o servidor
 * (validação definitiva). O banco ainda valida tudo de novo em create_order.
 */
import { addDays, onlyDigits, todayInSaoPaulo } from "./format";
import { daysLabel, joinNames } from "./lead-time";
import type { FulfillmentType } from "./types";

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  addressMin: 5,
  addressMax: 300,
  notesMax: 500,
  maxItems: 40,
  maxQuantity: 999,
  maxDaysAhead: 180,
} as const;

export type CheckoutInput = {
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType | "";
  /** Local de entrega escolhido (quando a dona cadastrou locais). */
  deliveryZoneId: string;
  deliveryAddress: string;
  requestedDate: string;
  requestedTime: string;
  notes: string;
  items: { productId: string; quantity: number }[];
  /** Campo-armadilha para robôs: pessoas não veem nem preenchem. */
  website?: string;
};

export type CheckoutField =
  | "customerName"
  | "customerPhone"
  | "fulfillmentType"
  | "deliveryZoneId"
  | "deliveryAddress"
  | "requestedDate"
  | "requestedTime"
  | "notes"
  | "items";

export type FieldErrors = Partial<Record<CheckoutField, string>>;

export type CheckoutRules = {
  offersPickup: boolean;
  offersDelivery: boolean;
  /** Antecedência que vale para ESTE pedido (a maior entre a geral e a das categorias). */
  minLeadDays: number | null;
  /** Categorias responsáveis pela antecedência, quando ela é maior que a geral. */
  leadCategories?: string[];
  /** IDs dos locais de entrega ativos (vazio = taxa "a combinar"). */
  zoneIds: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function earliestDate(minLeadDays: number | null, now: Date = new Date()): string {
  return addDays(todayInSaoPaulo(now), minLeadDays ?? 0);
}

export function latestDate(now: Date = new Date()): string {
  return addDays(todayInSaoPaulo(now), LIMITS.maxDaysAhead);
}

export function validateCheckout(input: CheckoutInput, rules: CheckoutRules, now: Date = new Date()): FieldErrors {
  const errors: FieldErrors = {};

  const name = normalizeName(input.customerName);
  if (name.length < LIMITS.nameMin) errors.customerName = "Informe seu nome.";
  else if (name.length > LIMITS.nameMax) errors.customerName = `Use no máximo ${LIMITS.nameMax} caracteres.`;

  const phone = onlyDigits(input.customerPhone);
  if (!phone) errors.customerPhone = "Informe um telefone ou WhatsApp para contato.";
  else if (phone.length < 10 || phone.length > 13)
    errors.customerPhone = "Confira o número: inclua o DDD, por exemplo (11) 98888-7777.";

  if (input.fulfillmentType !== "pickup" && input.fulfillmentType !== "delivery") {
    errors.fulfillmentType = "Escolha como prefere receber o pedido.";
  } else if (input.fulfillmentType === "pickup" && !rules.offersPickup) {
    errors.fulfillmentType = "No momento não estamos fazendo retiradas.";
  } else if (input.fulfillmentType === "delivery" && !rules.offersDelivery) {
    errors.fulfillmentType = "No momento não estamos fazendo entregas.";
  }

  if (input.fulfillmentType === "delivery" && rules.zoneIds.length > 0 && !rules.zoneIds.includes(input.deliveryZoneId)) {
    errors.deliveryZoneId = "Escolha o local da entrega.";
  }

  if (input.fulfillmentType === "delivery") {
    const address = input.deliveryAddress.trim();
    if (address.length < LIMITS.addressMin) errors.deliveryAddress = "Informe o endereço completo para a entrega.";
    else if (address.length > LIMITS.addressMax)
      errors.deliveryAddress = `Use no máximo ${LIMITS.addressMax} caracteres.`;
  }

  if (!DATE_RE.test(input.requestedDate)) {
    errors.requestedDate = "Escolha a data em que você precisa da encomenda.";
  } else {
    const min = earliestDate(rules.minLeadDays, now);
    if (input.requestedDate < min) {
      const reason = rules.leadCategories?.length ? ` para ${joinNames(rules.leadCategories)}` : "";
      errors.requestedDate =
        rules.minLeadDays && rules.minLeadDays > 0
          ? `Pedimos pelo menos ${daysLabel(rules.minLeadDays)} de antecedência${reason}.`
          : "Escolha uma data a partir de hoje.";
    } else if (input.requestedDate > latestDate(now)) {
      errors.requestedDate = "Escolha uma data nos próximos 6 meses.";
    }
  }

  if (input.requestedTime && !TIME_RE.test(input.requestedTime)) {
    errors.requestedTime = "Horário inválido.";
  }

  if (input.notes.trim().length > LIMITS.notesMax) {
    errors.notes = `Use no máximo ${LIMITS.notesMax} caracteres.`;
  }

  const ids = new Set<string>();
  const itemsOk =
    Array.isArray(input.items) &&
    input.items.length > 0 &&
    input.items.length <= LIMITS.maxItems &&
    input.items.every((item) => {
      if (!isUuid(item.productId) || ids.has(item.productId)) return false;
      ids.add(item.productId);
      return Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= LIMITS.maxQuantity;
    });
  if (!itemsOk) errors.items = "Seu pedido está vazio ou tem quantidades inválidas.";

  return errors;
}

/** Mensagens amigáveis para os códigos de erro devolvidos pelo banco. */
export function orderErrorMessage(code: string | undefined): string {
  switch (code) {
    case "ORDERS_CLOSED":
      return "No momento não estamos recebendo encomendas pelo site.";
    case "PRODUCT_UNAVAILABLE":
      return "Algum produto do seu pedido acabou de ficar indisponível. Revise o pedido e tente de novo.";
    case "FULFILLMENT_UNAVAILABLE":
      return "A forma de entrega escolhida não está disponível agora. Escolha outra opção.";
    case "INVALID_DATE":
      return "A data escolhida não está disponível. Escolha outra data.";
    case "INVALID_ZONE":
      return "Escolha o local da entrega. Se os locais mudaram, atualize a página.";
    case "INVALID_ADDRESS":
      return "Confira o endereço de entrega.";
    case "INVALID_NAME":
      return "Confira o nome informado.";
    case "INVALID_PHONE":
      return "Confira o telefone informado (com DDD).";
    case "INVALID_NOTES":
      return "As observações estão muito longas.";
    case "INVALID_ITEMS":
      return "Seu pedido tem itens inválidos. Revise as quantidades.";
    case "DAILY_LIMIT":
      return "Cada cliente pode fazer até 2 pedidos por dia, e você já chegou nesse limite hoje. Se precisar mudar algo, fale com a gente pelo WhatsApp.";
    case "WEEKLY_LIMIT":
      return "Cada cliente pode fazer até 5 pedidos a cada 7 dias, e você já chegou nesse limite. Se precisar de algo, fale com a gente pelo WhatsApp.";
    case "RATE_LIMITED":
      return "Recebemos vários pedidos seguidos deste contato. Aguarde um pouco ou fale conosco pelo WhatsApp.";
    case "DUPLICATE_ORDER":
      return "Este pedido já foi enviado antes. Atualize a página para fazer um novo pedido.";
    default:
      return "Não foi possível registrar o pedido agora. Seu pedido NÃO foi enviado. Tente novamente em instantes.";
  }
}

/** Códigos que indicam erro definitivo (o mesmo envio não vai dar certo). */
export const DEFINITIVE_ORDER_ERRORS = new Set([
  "ORDERS_CLOSED",
  "PRODUCT_UNAVAILABLE",
  "FULFILLMENT_UNAVAILABLE",
  "INVALID_DATE",
  "INVALID_ADDRESS",
  "INVALID_ZONE",
  "INVALID_NAME",
  "INVALID_PHONE",
  "INVALID_NOTES",
  "INVALID_ITEMS",
  "DUPLICATE_ORDER",
  "DAILY_LIMIT",
  "WEEKLY_LIMIT",
  "VALIDATION",
]);
