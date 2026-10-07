"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getOrdersSignal, type OrdersSignal } from "@/actions/admin-orders";
import { CloseIcon } from "@/components/icons";

const INTERVAL_MS = 20_000;

/**
 * Mantém o painel atualizado sem a dona recarregar a página.
 *
 * Por que não Supabase Realtime? A sessão do painel fica em cookies httpOnly
 * (o JavaScript do navegador não tem acesso ao token), o que protege contra
 * roubo de sessão. Sem o token no navegador, o Realtime não conseguiria passar
 * pela RLS. Então usamos uma checagem leve no servidor a cada 20 s, só com a
 * aba visível, e recarregamos os dados apenas quando algo mudou.
 */
export function LiveOrderUpdates() {
  const router = useRouter();
  const last = useRef<OrdersSignal | null>(null);
  const [newOrders, setNewOrders] = useState(0);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    async function check() {
      if (document.visibilityState !== "visible") return;
      let signal: OrdersSignal | null = null;
      try {
        signal = await getOrdersSignal();
      } catch {
        return; // sem internet: tenta de novo no próximo ciclo
      }
      if (stopped || !signal) return;
      const previous = last.current;
      last.current = signal;
      document.title = signal.pending > 0 ? `(${signal.pending}) Painel de encomendas` : "Painel de encomendas";
      if (!previous) return;
      if (signal.latestCreatedAt && previous.latestCreatedAt && signal.latestCreatedAt > previous.latestCreatedAt) {
        setNewOrders((n) => n + 1);
      }
      if (signal.latestUpdatedAt !== previous.latestUpdatedAt || signal.pending !== previous.pending) {
        router.refresh();
      }
    }

    function schedule() {
      timer = window.setInterval(check, INTERVAL_MS);
    }

    check();
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (newOrders === 0) return null;
  return (
    <div
      role="status"
      className="animate-toast fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#2e2429] px-5 py-4 text-white shadow-xl sm:inset-x-auto sm:right-6"
    >
      <span className="flex-1 font-bold">
        {newOrders === 1 ? "Chegou um pedido novo!" : `Chegaram ${newOrders} pedidos novos!`}
      </span>
      <Link href="/admin/pedidos?status=pending" className="btn btn-light btn-sm" onClick={() => setNewOrders(0)}>
        Ver
      </Link>
      <button
        type="button"
        onClick={() => setNewOrders(0)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
        aria-label="Fechar aviso"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
