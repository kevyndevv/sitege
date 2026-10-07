"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { isOrderStatus } from "@/lib/order-status";
import { revalidatePublicPages } from "@/lib/revalidate";
import { isUuid } from "@/lib/validation";

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };

const FORBIDDEN: ActionResult = { ok: false, message: "Sua sessão expirou. Entre novamente." };

/** Muda a situação de um pedido. O histórico é gravado automaticamente no banco. */
export async function updateOrderStatus(orderId: unknown, status: unknown): Promise<ActionResult> {
  if (!isUuid(orderId) || !isOrderStatus(status)) return { ok: false, message: "Pedido ou situação inválidos." };
  let session;
  try {
    session = await assertAdmin();
  } catch {
    return FORBIDDEN;
  }
  const { data, error } = await session.supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[updateOrderStatus] falha:", error?.code ?? "não encontrado");
    return { ok: false, message: "Não foi possível atualizar o pedido. Tente novamente." };
  }
  revalidatePath("/admin", "layout");
  // A situação muda a lista de "mais pedidos" (que considera só pedidos confirmados).
  revalidatePublicPages();
  return { ok: true, message: "Situação atualizada." };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Anotações internas e data/horário combinados. Somente estes campos podem mudar. */
export async function updateOrderDetails(orderId: unknown, formData: FormData): Promise<ActionResult> {
  if (!isUuid(orderId)) return { ok: false, message: "Pedido inválido." };
  const notes = formData.get("admin_notes");
  const date = formData.get("requested_date");
  const time = formData.get("requested_time");

  const adminNotes = typeof notes === "string" ? notes.trim() : "";
  if (adminNotes.length > 1000) return { ok: false, message: "As anotações podem ter até 1000 caracteres." };
  const requestedDate = typeof date === "string" && date ? date : null;
  if (requestedDate && !DATE_RE.test(requestedDate)) return { ok: false, message: "Data inválida." };
  const requestedTime = typeof time === "string" && time ? time.slice(0, 5) : null;
  if (requestedTime && !TIME_RE.test(requestedTime)) return { ok: false, message: "Horário inválido." };

  let session;
  try {
    session = await assertAdmin();
  } catch {
    return FORBIDDEN;
  }
  const { error } = await session.supabase
    .from("orders")
    .update({ admin_notes: adminNotes || null, requested_date: requestedDate, requested_time: requestedTime })
    .eq("id", orderId);
  if (error) {
    console.error("[updateOrderDetails] falha:", error.code);
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Alterações salvas." };
}

export type OrdersSignal = { latestCreatedAt: string | null; latestUpdatedAt: string | null; pending: number };

/**
 * "Sinal" leve para o painel saber se algo mudou, sem recarregar tudo:
 * 2 consultas pequenas usando índices. O painel chama a cada ~20 s apenas
 * enquanto a aba está visível.
 */
export async function getOrdersSignal(): Promise<OrdersSignal | null> {
  let session;
  try {
    session = await assertAdmin();
  } catch {
    return null;
  }
  const [updated, created, pending] = await Promise.all([
    session.supabase.from("orders").select("updated_at").order("updated_at", { ascending: false }).limit(1),
    session.supabase.from("orders").select("created_at").order("created_at", { ascending: false }).limit(1),
    session.supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  if (updated.error || created.error || pending.error) return null;
  return {
    latestCreatedAt: created.data?.[0]?.created_at ?? null,
    latestUpdatedAt: updated.data?.[0]?.updated_at ?? null,
    pending: pending.count ?? 0,
  };
}
