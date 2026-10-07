import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PAGE_SIZE, escapeLike, parsePage, startOfDaySP } from "@/lib/data/admin";
import { addDays, formatDateShort, formatMoney, formatRelativeDay, formatTime } from "@/lib/format";
import { ORDER_STATUSES, fulfillmentLabel, isOrderStatus, statusFilterLabel } from "@/lib/order-status";
import type { FulfillmentType, OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SearchIcon } from "@/components/icons";

export const metadata = { title: "Pedidos" };

type Row = {
  id: string;
  order_number: string;
  customer_name: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  requested_date: string | null;
  requested_time: string | null;
  total_cents: number;
  created_at: string;
};

type Search = { status?: string; de?: string; ate?: string; q?: string; pagina?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^[0-9A-Z]{4}-?[0-9A-Z]{1,4}$/i;

export default async function PedidosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : null;
  const from = sp.de && DATE_RE.test(sp.de) ? sp.de : "";
  const to = sp.ate && DATE_RE.test(sp.ate) ? sp.ate : "";
  const q = (sp.q ?? "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 60);
  const page = parsePage(sp.pagina);

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, status, fulfillment_type, requested_date, requested_time, total_cents, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("created_at", startOfDaySP(from));
  if (to) query = query.lt("created_at", startOfDaySP(addDays(to, 1)));
  if (q) {
    // Consultas parametrizadas pelo cliente do Supabase (sem montar SQL/filtros com texto do usuário).
    query = CODE_RE.test(q)
      ? query.ilike("order_number", `%${escapeLike(q.toUpperCase())}%`)
      : query.ilike("customer_name", `%${escapeLike(q)}%`);
  }

  const { data, count, error } = await query.returns<Row[]>();
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const filtered = Boolean(status || from || to || q);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (from) params.set("de", from);
    if (to) params.set("ate", to);
    if (q) params.set("q", q);
    if (p > 1) params.set("pagina", String(p));
    const s = params.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Pedidos</h1>
        <p className="text-suave">
          {count ?? 0} {count === 1 ? "pedido" : "pedidos"}
          {filtered ? " encontrados" : ""}
        </p>
      </div>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_auto] lg:items-end">
        <div>
          <label htmlFor="q" className="field-label">
            Buscar
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-suave" />
            <input id="q" name="q" defaultValue={q} placeholder="Nome do cliente ou código" className="input pl-10" />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="field-label">
            Situação
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input">
            <option value="">Todas</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusFilterLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="de" className="field-label">
            Feitos de
          </label>
          <input id="de" name="de" type="date" defaultValue={from} className="input" />
        </div>
        <div>
          <label htmlFor="ate" className="field-label">
            até
          </label>
          <input id="ate" name="ate" type="date" defaultValue={to} className="input" />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn btn-primary flex-1">
            Filtrar
          </button>
          {filtered ? (
            <Link href="/admin/pedidos" className="btn btn-ghost">
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
          Não foi possível carregar os pedidos. Atualize a página.
        </p>
      ) : !data || data.length === 0 ? (
        <EmptyState title={filtered ? "Nenhum pedido com esses filtros." : "Ainda não chegou nenhum pedido."}>
          {filtered ? "Tente mudar a busca ou o período." : "Os pedidos feitos pelo site aparecem aqui automaticamente."}
        </EmptyState>
      ) : (
        <>
          {/* Celular: cartões */}
          <ul className="space-y-3 md:hidden">
            {data.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="card block p-4 hover:border-ameixa">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{o.customer_name}</p>
                      <p className="text-sm text-suave">
                        {o.order_number}, {formatRelativeDay(o.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={o.status} fulfillment={o.fulfillment_type} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[0.98rem]">
                    <span className="text-suave">
                      {fulfillmentLabel(o.fulfillment_type)}
                      {o.requested_date ? ` em ${formatDateShort(o.requested_date)}` : ""}
                      {o.requested_time ? `, ${formatTime(o.requested_time)}` : ""}
                    </span>
                    <span className="font-bold">{formatMoney(o.total_cents)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Computador: tabela */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="border-b border-linha text-sm text-suave">
                <tr>
                  <th className="px-4 py-3 font-bold">Pedido</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Para quando</th>
                  <th className="px-4 py-3 text-right font-bold">Valor</th>
                  <th className="px-4 py-3 font-bold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {data.map((o) => (
                  <tr key={o.id} className="hover:bg-veu/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/pedidos/${o.id}`} className="font-bold tracking-wide text-tinta underline-offset-4 hover:underline">
                        {o.order_number}
                      </Link>
                      <span className="block text-sm text-suave">{formatRelativeDay(o.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">{o.customer_name}</td>
                    <td className="px-4 py-3">
                      {fulfillmentLabel(o.fulfillment_type)}
                      <span className="block text-sm text-suave">
                        {o.requested_date ? formatDateShort(o.requested_date) : "a combinar"}
                        {o.requested_time ? `, ${formatTime(o.requested_time)}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(o.total_cents)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} fulfillment={o.fulfillment_type} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
