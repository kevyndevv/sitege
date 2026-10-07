import type { FulfillmentType, OrderStatus } from "./types";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
];

/** Sequência normal de um pedido (sem o cancelamento). */
export const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "completed"];

export function statusLabel(status: OrderStatus, fulfillment?: FulfillmentType): string {
  switch (status) {
    case "pending":
      return "Aguardando confirmação";
    case "confirmed":
      return "Confirmado";
    case "preparing":
      return "Em preparação";
    case "ready":
      if (fulfillment === "delivery") return "Pronto para entrega";
      if (fulfillment === "pickup") return "Pronto para retirada";
      return "Pronto";
    case "completed":
      if (fulfillment === "delivery") return "Entregue";
      if (fulfillment === "pickup") return "Retirado";
      return "Concluído";
    case "cancelled":
      return "Cancelado";
  }
}

/** Rótulo curto usado em filtros do painel. */
export function statusFilterLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Aguardando confirmação";
    case "ready":
      return "Prontos";
    case "completed":
      return "Concluídos";
    case "cancelled":
      return "Cancelados";
    case "confirmed":
      return "Confirmados";
    case "preparing":
      return "Em preparação";
  }
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = STATUS_FLOW.indexOf(status);
  if (index === -1 || index === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

/** Texto do botão que avança o pedido para o próximo passo. */
export function advanceLabel(status: OrderStatus, fulfillment: FulfillmentType): string | null {
  switch (status) {
    case "pending":
      return "Confirmar pedido";
    case "confirmed":
      return "Começar preparo";
    case "preparing":
      return fulfillment === "delivery" ? "Marcar como pronto para entrega" : "Marcar como pronto para retirada";
    case "ready":
      return fulfillment === "delivery" ? "Marcar como entregue" : "Marcar como retirado";
    default:
      return null;
  }
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as string[]).includes(value);
}

export function fulfillmentLabel(type: FulfillmentType): string {
  return type === "delivery" ? "Entrega" : "Retirada";
}
