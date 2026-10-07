import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDateLong, formatDateTime, formatMoney, formatPhone, formatTime } from "@/lib/format";
import { fulfillmentLabel, statusLabel } from "@/lib/order-status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";
import { isUuid } from "@/lib/validation";
import { readyMessage, whatsappLink } from "@/lib/whatsapp";
import { OrderDetailsForm, OrderStatusActions } from "@/components/admin/OrderActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ArrowLeftIcon, ChatIcon } from "@/components/icons";

export const metadata = { title: "Pedido" };

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  delivery_address: string | null;
  delivery_zone_name: string | null;
  requested_date: string | null;
  requested_time: string | null;
  notes: string | null;
  admin_notes: string | null;
  delivery_fee_cents: number | null;
  total_cents: number;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    unit_label: string | null;
    unit_price_cents: number | null;
    quantity: number;
    subtotal_cents: number | null;
  }[];
  order_status_history: { id: string; from_status: OrderStatus | null; to_status: OrderStatus; created_at: string }[];
};

export default async function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdmin();

  const settingsPromise = supabase.from("business_settings").select("business_name").maybeSingle();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, status, fulfillment_type, delivery_address, delivery_zone_name, requested_date, requested_time, notes, admin_notes, delivery_fee_cents, total_cents, created_at, order_items(id, product_name, unit_label, unit_price_cents, quantity, subtotal_cents), order_status_history(id, from_status, to_status, created_at)",
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "order_status_history", ascending: true })
    .maybeSingle<Order>();

  if (error) {
    return (
      <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
        Não foi possível carregar o pedido. Atualize a página.
      </p>
    );
  }
  if (!order) notFound();

  const firstName = order.customer_name.split(" ")[0];
  const { data: settings } = await settingsPromise;
  // Mensagem de "pedido pronto" já escrita: a dona só aperta enviar no WhatsApp.
  const readyHref =
    order.status === "ready"
      ? whatsappLink(
          order.customer_phone,
          readyMessage({
            customerName: order.customer_name,
            businessName: (settings?.business_name as string | null | undefined) ?? null,
            orderNumber: order.order_number,
            totalFormatted: formatMoney(order.total_cents),
          }),
        )
      : null;
  const hasUnpriced = order.order_items.some((i) => i.subtotal_cents === null);

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="btn btn-ghost -ml-3">
        <ArrowLeftIcon className="h-5 w-5" />
        Todos os pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide sm:text-4xl">Pedido {order.order_number}</h1>
          <p className="mt-1 text-suave">Recebido em {formatDateTime(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} fulfillment={order.fulfillment_type} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section aria-labelledby="sec-situacao" className="card space-y-4 p-5 sm:p-6">
            <h2 id="sec-situacao" className="text-lg font-bold">
              O que fazer agora
            </h2>
            {readyHref ? (
              <div className="rounded-2xl border-2 border-ok bg-ok-fundo p-4">
                <p className="font-bold text-ok">Pedido pronto! Avise {firstName}:</p>
                <a
                  href={readyHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn mt-3 w-full bg-ok text-acucar hover:opacity-90 sm:w-auto"
                >
                  <ChatIcon className="h-5 w-5" />
                  Avisar cliente no WhatsApp
                </a>
                <p className="mt-2 text-sm text-suave">
                  O WhatsApp abre com a mensagem pronta para {formatPhone(order.customer_phone)}. É só tocar em enviar.
                </p>
              </div>
            ) : null}
            <OrderStatusActions orderId={order.id} status={order.status} fulfillment={order.fulfillment_type} />
          </section>

          <section aria-labelledby="sec-itens" className="card p-5 sm:p-6">
            <h2 id="sec-itens" className="text-lg font-bold">
              Produtos
            </h2>
            <ul className="mt-3 divide-y divide-linha">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3">
                  <span>
                    <strong className="text-lg">{item.quantity}×</strong> {item.product_name}
                    <span className="block text-sm text-suave">
                      {item.unit_price_cents === null
                        ? "preço a combinar"
                        : `${formatMoney(item.unit_price_cents)}${item.unit_label ? ` / ${item.unit_label}` : ""}`}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold">
                    {item.subtotal_cents === null ? "a combinar" : formatMoney(item.subtotal_cents)}
                  </span>
                </li>
              ))}
            </ul>
            {order.fulfillment_type === "delivery" ? (
              <p className="flex justify-between border-t border-linha pt-3 text-suave">
                <span>Taxa de entrega{order.delivery_zone_name ? ` (${order.delivery_zone_name})` : ""}</span>
                <span>
                  {order.delivery_fee_cents === null
                    ? "a combinar"
                    : order.delivery_fee_cents === 0
                      ? "grátis"
                      : formatMoney(order.delivery_fee_cents)}
                </span>
              </p>
            ) : null}
            <p className="mt-2 flex items-baseline justify-between border-t border-linha pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-3xl">{formatMoney(order.total_cents)}</span>
            </p>
            {hasUnpriced || (order.fulfillment_type === "delivery" && order.delivery_fee_cents === null) ? (
              <p className="mt-1 text-sm text-alerta">Há itens ou taxa “a combinar”: combine o valor final com o cliente.</p>
            ) : null}
          </section>

          <section aria-labelledby="sec-combinado" className="card p-5 sm:p-6">
            <h2 id="sec-combinado" className="mb-4 text-lg font-bold">
              Combinados e anotações
            </h2>
            <OrderDetailsForm
              orderId={order.id}
              adminNotes={order.admin_notes}
              requestedDate={order.requested_date}
              requestedTime={order.requested_time}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="sec-cliente" className="card space-y-4 p-5 sm:p-6">
            <h2 id="sec-cliente" className="text-lg font-bold">
              Cliente
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-bold text-suave">Nome</dt>
                <dd className="text-lg">{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-suave">Telefone</dt>
                <dd>
                  <a href={`tel:${order.customer_phone}`} className="text-lg underline underline-offset-4">
                    {formatPhone(order.customer_phone)}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-suave">{fulfillmentLabel(order.fulfillment_type)}</dt>
                <dd>
                  {order.requested_date ? formatDateLong(order.requested_date) : "Data a combinar"}
                  {order.requested_time ? `, às ${formatTime(order.requested_time)}` : ""}
                </dd>
              </div>
              {order.delivery_address ? (
                <div>
                  <dt className="text-sm font-bold text-suave">
                    Endereço de entrega{order.delivery_zone_name ? ` (${order.delivery_zone_name})` : ""}
                  </dt>
                  <dd className="whitespace-pre-line break-words">{order.delivery_address}</dd>
                </div>
              ) : null}
              {order.notes ? (
                <div>
                  <dt className="text-sm font-bold text-suave">Observações do cliente</dt>
                  <dd className="whitespace-pre-line break-words rounded-xl bg-veu p-3">{order.notes}</dd>
                </div>
              ) : null}
            </dl>
            <a
              className="btn btn-outline w-full"
              target="_blank"
              rel="noopener noreferrer"
              href={whatsappLink(order.customer_phone, `Olá, ${firstName}! Sobre o seu pedido ${order.order_number}:`)}
            >
              <ChatIcon className="h-5 w-5" />
              Conversar no WhatsApp
            </a>
          </section>

          <section aria-labelledby="sec-historico" className="card p-5 sm:p-6">
            <h2 id="sec-historico" className="text-lg font-bold">
              Histórico
            </h2>
            <ol className="mt-3 space-y-3">
              {order.order_status_history.map((h) => (
                <li key={h.id} className="border-l-2 border-ameixa-clara pl-3">
                  <p className="font-bold">
                    {h.from_status === null ? "Pedido recebido" : statusLabel(h.to_status, order.fulfillment_type)}
                  </p>
                  <p className="text-sm text-suave">{formatDateTime(h.created_at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
