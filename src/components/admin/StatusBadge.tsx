import { statusLabel } from "@/lib/order-status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  pending: "bg-alerta-fundo text-alerta",
  confirmed: "bg-info-fundo text-info",
  preparing: "bg-forno-fundo text-forno",
  ready: "bg-veu text-tinta",
  completed: "bg-ok-fundo text-ok",
  cancelled: "bg-erro-fundo text-erro",
};

export function StatusBadge({ status, fulfillment }: { status: OrderStatus; fulfillment?: FulfillmentType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold whitespace-nowrap ${STYLES[status]}`}>
      {statusLabel(status, fulfillment)}
    </span>
  );
}
