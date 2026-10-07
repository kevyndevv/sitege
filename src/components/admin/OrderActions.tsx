"use client";

import { useState, useTransition } from "react";
import { updateOrderDetails, updateOrderStatus, type ActionResult } from "@/actions/admin-orders";
import { ORDER_STATUSES, advanceLabel, nextStatus, statusLabel } from "@/lib/order-status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Spinner } from "@/components/ui/Spinner";

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`rounded-2xl px-4 py-3 font-bold ${result.ok ? "bg-ok-fundo text-ok" : "bg-erro-fundo text-erro"}`}
    >
      {result.ok ? (result.message ?? "Pronto!") : result.message}
    </p>
  );
}

export function OrderStatusActions({
  orderId,
  status,
  fulfillment,
}: {
  orderId: string;
  status: OrderStatus;
  fulfillment: FulfillmentType;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);
  const next = nextStatus(status);
  const label = advanceLabel(status, fulfillment);

  function change(target: OrderStatus) {
    startTransition(async () => {
      const r = await updateOrderStatus(orderId, target);
      setResult(r);
      setConfirm(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {next && label ? (
          <button type="button" className="btn btn-primary" disabled={isPending} onClick={() => change(next)}>
            {isPending ? <Spinner /> : null}
            {label}
          </button>
        ) : null}
        {status !== "cancelled" && status !== "completed" ? (
          <button type="button" className="btn btn-outline" disabled={isPending} onClick={() => setConfirm("cancelled")}>
            {status === "pending" ? "Recusar pedido" : "Cancelar pedido"}
          </button>
        ) : null}
        {status === "cancelled" ? (
          <button type="button" className="btn btn-outline" disabled={isPending} onClick={() => setConfirm("pending")}>
            Reabrir pedido
          </button>
        ) : null}
      </div>

      <details className="rounded-2xl bg-veu/60 p-4">
        <summary className="cursor-pointer font-bold text-tinta">Mudar para outra situação</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {ORDER_STATUSES.filter((s) => s !== status).map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-sm btn-outline"
              disabled={isPending}
              onClick={() => (s === "cancelled" ? setConfirm("cancelled") : change(s))}
            >
              {statusLabel(s, fulfillment)}
            </button>
          ))}
        </div>
      </details>

      <Feedback result={result} />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "cancelled" ? (status === "pending" ? "Recusar este pedido?" : "Cancelar este pedido?") : "Reabrir este pedido?"}
        description={
          confirm === "cancelled" ? (
            <p>
              O cliente verá o pedido como cancelado ao consultar. Pedidos cancelados não contam no limite de pedidos do
              cliente nem nos “mais pedidos”. Você pode reabrir depois, se precisar.
            </p>
          ) : (
            <p>O pedido volta para “Aguardando confirmação”.</p>
          )
        }
        confirmLabel={confirm === "cancelled" ? (status === "pending" ? "Sim, recusar" : "Sim, cancelar") : "Sim, reabrir"}
        danger={confirm === "cancelled"}
        busy={isPending}
        onConfirm={() => confirm && change(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export function OrderDetailsForm({
  orderId,
  adminNotes,
  requestedDate,
  requestedTime,
}: {
  orderId: string;
  adminNotes: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => setResult(await updateOrderDetails(orderId, data)));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requested_date" className="field-label">
            Data combinada
          </label>
          <input id="requested_date" name="requested_date" type="date" defaultValue={requestedDate ?? ""} className="input" />
        </div>
        <div>
          <label htmlFor="requested_time" className="field-label">
            Horário combinado
          </label>
          <input
            id="requested_time"
            name="requested_time"
            type="time"
            defaultValue={requestedTime?.slice(0, 5) ?? ""}
            className="input"
          />
        </div>
      </div>
      <div>
        <label htmlFor="admin_notes" className="field-label">
          Anotações internas <span className="font-normal text-suave">(o cliente não vê)</span>
        </label>
        <textarea id="admin_notes" name="admin_notes" maxLength={1000} defaultValue={adminNotes ?? ""} className="input" />
      </div>
      <Feedback result={result} />
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? <Spinner /> : null}
        Salvar alterações
      </button>
    </form>
  );
}
