"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { revalidatePublicPages } from "@/lib/revalidate";
import { isUuid } from "@/lib/validation";

export type ZoneResult = { ok: true; message?: string } | { ok: false; message: string };

const SESSION_EXPIRED: ZoneResult = { ok: false, message: "Sua sessão expirou. Entre novamente." };

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}

function cleanFee(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cents = parseMoneyToCents(value.trim());
  return cents !== null && cents <= 1_000_000 ? cents : null;
}

async function session() {
  try {
    return await assertAdmin();
  } catch {
    return null;
  }
}

function refresh() {
  revalidatePath("/admin/configuracoes");
  revalidatePublicPages();
}

/** Cria um local de entrega (nome + taxa). Só a dona (verificado aqui e na RLS). */
export async function createZone(name: unknown, fee: unknown): Promise<ZoneResult> {
  const n = cleanName(name);
  const f = cleanFee(fee);
  if (!n) return { ok: false, message: "Informe o nome do local (até 60 caracteres)." };
  if (f === null) return { ok: false, message: "Informe a taxa. Exemplo: 10,00 (ou 0 para grátis)." };
  const s = await session();
  if (!s) return SESSION_EXPIRED;
  const { data: last } = await s.supabase
    .from("delivery_zones")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await s.supabase
    .from("delivery_zones")
    .insert({ name: n, fee_cents: f, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    return { ok: false, message: error.code === "23505" ? "Já existe um local com esse nome." : "Não foi possível salvar." };
  }
  refresh();
  return { ok: true, message: "Local adicionado." };
}

export async function updateZone(id: unknown, name: unknown, fee: unknown, active: unknown): Promise<ZoneResult> {
  const n = cleanName(name);
  const f = cleanFee(fee);
  if (!isUuid(id) || typeof active !== "boolean") return { ok: false, message: "Dados inválidos." };
  if (!n) return { ok: false, message: "Informe o nome do local (até 60 caracteres)." };
  if (f === null) return { ok: false, message: "Informe a taxa. Exemplo: 10,00 (ou 0 para grátis)." };
  const s = await session();
  if (!s) return SESSION_EXPIRED;
  const { error } = await s.supabase.from("delivery_zones").update({ name: n, fee_cents: f, active }).eq("id", id);
  if (error) {
    return { ok: false, message: error.code === "23505" ? "Já existe um local com esse nome." : "Não foi possível salvar." };
  }
  refresh();
  return { ok: true, message: "Local atualizado." };
}

/** Pedidos antigos guardam o nome e a taxa do local, então apagar é seguro. */
export async function deleteZone(id: unknown): Promise<ZoneResult> {
  if (!isUuid(id)) return { ok: false, message: "Local inválido." };
  const s = await session();
  if (!s) return SESSION_EXPIRED;
  const { error } = await s.supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir." };
  refresh();
  return { ok: true, message: "Local excluído." };
}
