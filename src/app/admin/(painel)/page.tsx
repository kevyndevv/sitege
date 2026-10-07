import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { parsePeriod, periodRange, startOfDaySP, type AdminStats, type Period } from "@/lib/data/admin";
import { formatMoney, formatRelativeDay, todayInSaoPaulo } from "@/lib/format";
import type { BusinessSettings, FulfillmentType, OrderStatus } from "@/lib/types";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const metadata = { title: "Painel" };

type PendingOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  total_cents: number;
  created_at: string;
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { supabase } = await requireAdmin();
  const period = parsePeriod((await searchParams).periodo);
  const range = periodRange(period);

  const [statsRes, pendingRes, todayRes, settingsRes, productsRes] = await Promise.all([
    supabase.rpc("get_admin_stats", { p_from: range.from, p_to: range.to }),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, status, fulfillment_type, total_cents, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5)
      .returns<PendingOrder[]>(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDaySP(todayInSaoPaulo())),
    supabase
      .from("business_settings")
      .select("whatsapp_number, offers_pickup, offers_delivery, business_name")
      .maybeSingle<Pick<BusinessSettings, "whatsapp_number" | "offers_pickup" | "offers_delivery" | "business_name">>(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("archived", false),
  ]);

  if (statsRes.error) {
    return (
      <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
        Não foi possível carregar o painel agora. Atualize a página.
      </p>
    );
  }

  const stats = statsRes.data as AdminStats;
  const open = stats.open_by_status;
  const settings = settingsRes.data;
  const setupTasks = [
    !settings?.business_name && { href: "/admin/configuracoes", text: "Informe o nome do negócio" },
    !(settings?.offers_pickup || settings?.offers_delivery) && {
      href: "/admin/configuracoes",
      text: "Escolha se faz retirada e/ou entrega (sem isso, ninguém consegue pedir)",
    },
    !settings?.whatsapp_number && { href: "/admin/configuracoes", text: "Cadastre o WhatsApp para os clientes falarem com você" },
    (productsRes.count ?? 0) === 0 && { href: "/admin/produtos/novo", text: "Cadastre o primeiro produto" },
  ].filter(Boolean) as { href: string; text: string }[];

  const cards: { label: string; value: number; href: string; highlight?: boolean }[] = [
    { label: "Novos hoje", value: todayRes.count ?? 0, href: "/admin/pedidos" },
    { label: "Aguardando confirmação", value: open.pending ?? 0, href: "/admin/pedidos?status=pending", highlight: (open.pending ?? 0) > 0 },
    { label: "Confirmados", value: open.confirmed ?? 0, href: "/admin/pedidos?status=confirmed" },
    { label: "Em preparação", value: open.preparing ?? 0, href: "/admin/pedidos?status=preparing" },
    { label: "Prontos", value: open.ready ?? 0, href: "/admin/pedidos?status=ready" },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Olá! Aqui está o resumo das encomendas.</h1>
      </div>

      {setupTasks.length > 0 ? (
        <section aria-labelledby="primeiros-passos" className="rounded-[var(--radius-card)] bg-alerta-fundo p-5 text-alerta sm:p-6">
          <h2 id="primeiros-passos" className="text-lg font-bold">
            Falta pouco para o site ficar completo
          </h2>
          <ul className="mt-3 space-y-2">
            {setupTasks.map((task) => (
              <li key={task.text}>
                <Link href={task.href} className="underline underline-offset-4">
                  {task.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="agora">
        <h2 id="agora" className="mb-4 text-lg font-bold text-suave">
          Agora
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((card) => (
            <li key={card.label}>
              <Link
                href={card.href}
                className={`card flex h-full flex-col justify-between gap-2 p-4 hover:border-ameixa ${card.highlight ? "border-2 border-ameixa" : ""}`}
              >
                <span className="text-[0.95rem] font-bold text-suave">{card.label}</span>
                <span className="font-display text-4xl text-calda">{card.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="aguardando" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="aguardando" className="font-display text-2xl">
            Aguardando sua confirmação
          </h2>
          <Link href="/admin/pedidos?status=pending" className="btn btn-ghost btn-sm">
            Ver todos
          </Link>
        </div>
        {pendingRes.data && pendingRes.data.length > 0 ? (
          <ul className="card divide-y divide-linha">
            {pendingRes.data.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-veu/60">
                  <span>
                    <span className="font-bold">{o.customer_name}</span>
                    <span className="block text-sm text-suave">
                      {o.order_number}, {formatRelativeDay(o.created_at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold">{formatMoney(o.total_cents)}</span>
                    <StatusBadge status={o.status} fulfillment={o.fulfillment_type} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhum pedido aguardando.">Quando chegar um pedido novo, ele aparece aqui sozinho.</EmptyState>
        )}
      </section>

      <section aria-labelledby="periodo" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="periodo" className="font-display text-2xl">
            Resultados {range.label}
          </h2>
          <PeriodSwitch current={period} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <dl className="card grid grid-cols-2 gap-4 p-5">
            <Stat label="Pedidos recebidos" value={String(stats.orders_in_period)} />
            <Stat label="Valor (sem cancelados)" value={formatMoney(stats.revenue_cents)} />
            <Stat label="Concluídos" value={String(stats.by_status.completed ?? 0)} />
            <Stat label="Cancelados" value={String(stats.by_status.cancelled ?? 0)} />
          </dl>
          <div className="card p-5">
            <h3 className="font-bold">Produtos mais pedidos</h3>
            {stats.top_products.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {stats.top_products.map((p) => (
                  <li key={p.name} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 text-suave">
                      {p.quantity} {p.quantity === 1 ? "unidade" : "unidades"} em {p.orders} {p.orders === 1 ? "pedido" : "pedidos"}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-suave">Ainda não há pedidos neste período.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-suave">{label}</dt>
      <dd className="font-display mt-1 text-3xl">{value}</dd>
    </div>
  );
}

function PeriodSwitch({ current }: { current: Period }) {
  const options: { value: Period; label: string }[] = [
    { value: "hoje", label: "Hoje" },
    { value: "7dias", label: "7 dias" },
    { value: "30dias", label: "30 dias" },
  ];
  return (
    <div className="inline-flex rounded-full border border-linha bg-glace p-1" role="group" aria-label="Período">
      {options.map((o) => (
        <Link
          key={o.value}
          href={`/admin?periodo=${o.value}`}
          aria-current={current === o.value ? "true" : undefined}
          className={`rounded-full px-4 py-2 font-bold ${current === o.value ? "bg-ameixa text-white" : "text-tinta hover:bg-veu"}`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
