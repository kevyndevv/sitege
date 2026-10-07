"use client";

import { useEffect, useState, useTransition } from "react";
import { trackOrdersByPhone } from "@/actions/orders";
import { formatDateLong, formatDateTime, formatMoney, formatTime } from "@/lib/format";
import { takePhoneForTracking } from "@/lib/my-orders-store";
import { fulfillmentLabel, statusLabel } from "@/lib/order-status";
import type { TrackedOrder } from "@/lib/types";
import { whatsappLink } from "@/lib/whatsapp";
import { BagIcon, ChatIcon, PinIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { StatusTimeline } from "./StatusTimeline";

type Props = {
  businessName: string;
  whatsapp: string | null;
  pickupInfo: string | null;
};

type View = { orders: TrackedOrder[] | null; error: string | null };

async function runLookup(phone: string): Promise<View> {
  try {
    const result = await trackOrdersByPhone(phone);
    return result.ok ? { orders: result.orders, error: null } : { orders: null, error: result.message };
  } catch {
    return { orders: null, error: "Não foi possível falar com o servidor. Verifique sua internet e tente de novo." };
  }
}

const OPEN = new Set(["pending", "confirmed", "preparing", "ready"]);

/** Pedidos prontos primeiro, depois os em andamento, depois os encerrados. */
function sortOrders(orders: TrackedOrder[]): TrackedOrder[] {
  const weight = (o: TrackedOrder) => (o.status === "ready" ? 0 : OPEN.has(o.status) ? 1 : 2);
  return [...orders].sort((a, b) => weight(a) - weight(b) || b.created_at.localeCompare(a.created_at));
}

export function TrackOrder({ businessName, whatsapp, pickupInfo }: Props) {
  const [phone, setPhone] = useState("");
  const [view, setView] = useState<View>({ orders: null, error: null });
  const [isPending, startTransition] = useTransition();

  function lookup(value: string) {
    startTransition(async () => setView(await runLookup(value)));
  }

  // Veio da tela de confirmação: já consulta com o telefone usado no pedido.
  useEffect(() => {
    const fromCheckout = takePhoneForTracking();
    if (!fromCheckout) return;
    startTransition(async () => {
      const result = await runLookup(fromCheckout);
      setPhone(fromCheckout);
      setView(result);
    });
  }, []);

  const orders = view.orders ? sortOrders(view.orders) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr] lg:items-start">
      <form
        className="card space-y-4 p-5 sm:p-6 lg:sticky lg:top-24"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(phone);
        }}
      >
        <h2 className="font-display text-2xl">Consultar pedido</h2>
        <div>
          <label htmlFor="telefone" className="field-label">
            Seu telefone ou WhatsApp
          </label>
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 98888-7777"
            maxLength={20}
            className="input text-lg"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <span className="field-hint">O mesmo número que você informou ao fazer o pedido.</span>
        </div>
        <button type="submit" className="btn btn-primary w-full" disabled={isPending} aria-busy={isPending}>
          {isPending ? (
            <>
              <Spinner /> Consultando…
            </>
          ) : (
            "Ver meus pedidos"
          )}
        </button>
      </form>

      <div aria-live="polite" className="space-y-6">
        {view.error ? (
          <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
            {view.error}
          </p>
        ) : null}

        {isPending && !orders ? (
          <div className="card space-y-4 p-6" aria-label="Carregando pedidos">
            <div className="skeleton h-8 w-1/2 rounded-lg" />
            <div className="skeleton h-4 w-1/3 rounded-lg" />
            <div className="skeleton h-40 w-full rounded-2xl" />
          </div>
        ) : null}

        {orders && orders.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-12 text-center">
            <p className="font-display text-2xl text-tinta">Nenhum pedido encontrado.</p>
            <p className="mt-2 text-suave">
              Não achamos pedidos feitos com este telefone nos últimos 60 dias. Confira o número, com DDD.
            </p>
          </div>
        ) : null}

        {orders?.map((order) => (
          <OrderDetails
            key={order.order_number}
            order={order}
            businessName={businessName}
            whatsapp={whatsapp}
            pickupInfo={pickupInfo}
            onRefresh={() => lookup(phone)}
            refreshing={isPending}
          />
        ))}

        {!orders && !view.error && !isPending ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-12 text-center text-suave">
            Digite o seu telefone para ver a situação das suas encomendas.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReadyBanner({
  order,
  businessName,
  whatsapp,
  pickupInfo,
}: {
  order: TrackedOrder;
  businessName: string;
  whatsapp: string | null;
  pickupInfo: string | null;
}) {
  const pickup = order.fulfillment_type === "pickup";
  return (
    <div className="bg-ok px-5 py-6 text-acucar sm:px-7" role="status">
      <div className="flex items-start gap-4">
        <span className="relative mt-1 flex h-14 w-14 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute inset-0 animate-ping rounded-full bg-acucar/30" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-acucar text-ok">
            <BagIcon className="h-8 w-8" />
          </span>
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight sm:text-3xl">
            {pickup ? "Seu pedido está pronto para retirada!" : "Seu pedido está pronto e logo sai para entrega!"}
          </p>
          <p className="mt-1 text-lg opacity-95">
            {pickup
              ? `Pode vir buscar${order.requested_time ? ` a partir das ${formatTime(order.requested_time)}` : ""}.`
              : `${businessName} já está com tudo separado para você.`}
          </p>
          {pickup && pickupInfo ? (
            <p className="mt-3 flex items-start gap-2 whitespace-pre-line rounded-xl bg-acucar/15 p-3">
              <PinIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{pickupInfo}</span>
            </p>
          ) : null}
          {whatsapp ? (
            <a
              className="btn mt-4 bg-acucar text-ok hover:opacity-90"
              target="_blank"
              rel="noopener noreferrer"
              href={whatsappLink(
                whatsapp,
                pickup
                  ? `Olá! Vi que o pedido ${order.order_number} está pronto. Estou indo buscar.`
                  : `Olá! Vi que o pedido ${order.order_number} está pronto.`,
              )}
            >
              <ChatIcon className="h-5 w-5" />
              {pickup ? "Avisar que estou indo" : "Falar pelo WhatsApp"}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OrderDetails({
  order,
  businessName,
  whatsapp,
  pickupInfo,
  onRefresh,
  refreshing,
}: {
  order: TrackedOrder;
  businessName: string;
  whatsapp: string | null;
  pickupInfo: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const hasUnpriced = order.items.some((i) => i.subtotal_cents === null);
  const ready = order.status === "ready";
  const closed = order.status === "completed" || order.status === "cancelled";

  const body = (
    <div className="grid gap-8 px-5 py-6 sm:px-7 md:grid-cols-2">
      <section aria-label="Andamento">
        <h3 className="mb-4 text-lg font-bold">Andamento</h3>
        <StatusTimeline status={order.status} fulfillment={order.fulfillment_type} history={order.history} />
      </section>

      <section aria-label="Resumo" className="space-y-4">
        <h3 className="text-lg font-bold">Resumo</h3>
        <p>
          <span className="block text-sm font-bold text-suave">{fulfillmentLabel(order.fulfillment_type)} para</span>
          {order.requested_date ? formatDateLong(order.requested_date) : "a combinar"}
          {order.requested_time ? `, às ${formatTime(order.requested_time)}` : ""}
        </p>
        <ul className="divide-y divide-linha">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span>
                {item.quantity}× {item.product_name}
              </span>
              <span className="shrink-0 text-suave">
                {item.subtotal_cents === null ? "a combinar" : formatMoney(item.subtotal_cents)}
              </span>
            </li>
          ))}
        </ul>
        {order.fulfillment_type === "delivery" ? (
          <p className="flex justify-between text-suave">
            <span>Taxa de entrega</span>
            <span>
              {order.delivery_fee_cents === null
                ? "a combinar"
                : order.delivery_fee_cents === 0
                  ? "grátis"
                  : formatMoney(order.delivery_fee_cents)}
            </span>
          </p>
        ) : null}
        <p className="flex items-baseline justify-between border-t border-linha pt-3">
          <span className="font-bold">Total</span>
          <span className="font-display text-2xl">{formatMoney(order.total_cents)}</span>
        </p>
        {hasUnpriced || (order.fulfillment_type === "delivery" && order.delivery_fee_cents === null) ? (
          <p className="text-sm text-suave">Há valores a combinar, informados na confirmação.</p>
        ) : null}
      </section>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-suave">Pedido</p>
        <h2 className="font-display text-2xl tracking-wider sm:text-3xl">{order.order_number}</h2>
        <p className="mt-1 text-suave">Feito em {formatDateTime(order.created_at)}</p>
      </div>
      <span
        className={`rounded-full px-3 py-1 font-bold ${
          ready ? "bg-ok text-acucar" : order.status === "cancelled" ? "bg-erro-fundo text-erro" : "bg-ameixa text-white"
        }`}
      >
        {statusLabel(order.status, order.fulfillment_type)}
      </span>
    </div>
  );

  // Pedidos encerrados ficam recolhidos para não poluir a tela.
  if (closed) {
    return (
      <details className="card overflow-hidden">
        <summary className="cursor-pointer list-none px-5 py-5 sm:px-7 [&::-webkit-details-marker]:hidden">
          {header}
          <span className="mt-2 inline-block text-sm font-bold text-tinta underline underline-offset-4">Ver detalhes</span>
        </summary>
        {body}
      </details>
    );
  }

  return (
    <article className={`card overflow-hidden ${ready ? "border-2 border-ok shadow-[0_0_0_6px_var(--color-ok-fundo)]" : ""}`}>
      {ready ? <ReadyBanner order={order} businessName={businessName} whatsapp={whatsapp} pickupInfo={pickupInfo} /> : null}
      <header className="bg-veu px-5 py-5 sm:px-7">
        {header}
        <button type="button" className="btn btn-ghost btn-sm -ml-3 mt-2" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <Spinner /> : null} Atualizar
        </button>
      </header>
      {body}
    </article>
  );
}
