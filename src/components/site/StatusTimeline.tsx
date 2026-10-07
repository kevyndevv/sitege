import { formatDateTime } from "@/lib/format";
import { STATUS_FLOW, statusLabel } from "@/lib/order-status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

type Props = {
  status: OrderStatus;
  fulfillment: FulfillmentType;
  history: { status: OrderStatus; at: string }[];
};

/** Linha do tempo do pedido. É uma sequência real, por isso os passos numerados. */
export function StatusTimeline({ status, fulfillment, history }: Props) {
  if (status === "cancelled") {
    const when = [...history].reverse().find((h) => h.status === "cancelled")?.at;
    return (
      <div className="rounded-2xl bg-erro-fundo p-5 text-erro">
        <p className="text-lg font-bold">Este pedido foi cancelado.</p>
        {when ? <p className="mt-1">Em {formatDateTime(when)}.</p> : null}
        <p className="mt-1">Se tiver dúvidas, fale com a gente pelo WhatsApp.</p>
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(status);
  const lastAt = (s: OrderStatus) => [...history].reverse().find((h) => h.status === s)?.at;

  return (
    <ol>
      {STATUS_FLOW.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        // "Pronto" é o momento em que o cliente precisa agir: ganha destaque próprio.
        const readyNow = current && step === "ready";
        const at = index <= currentIndex ? lastAt(step) : undefined;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {index < STATUS_FLOW.length - 1 ? (
              <span
                className={`absolute left-[1.05rem] top-9 h-[calc(100%-2.25rem)] w-0.5 ${done ? "bg-ameixa" : "bg-linha"}`}
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10 shrink-0" aria-hidden="true">
              {readyNow ? <span className="absolute inset-0 animate-ping rounded-full bg-ok/40" /> : null}
              <span
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${
                  readyNow
                    ? "border-ok bg-ok text-acucar"
                    : done
                      ? "border-ameixa bg-ameixa text-white"
                      : current
                        ? "border-ameixa bg-glace text-tinta ring-4 ring-veu"
                        : "border-linha bg-glace text-suave"
                }`}
              >
                {done || readyNow ? <CheckIcon className="h-5 w-5" /> : index + 1}
              </span>
            </span>
            <div className="pt-1">
              <p
                className={
                  readyNow
                    ? "text-lg font-bold text-ok"
                    : current
                      ? "font-bold text-calda"
                      : done
                        ? "text-calda"
                        : "text-suave"
                }
              >
                {statusLabel(step, fulfillment)}
                {current ? <span className="sr-only"> (situação atual)</span> : null}
              </p>
              {at ? <p className="text-sm text-suave">{formatDateTime(at)}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
