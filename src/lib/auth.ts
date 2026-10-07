import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabase/config";
import { getServerClient } from "./supabase/server";

export type AdminSession = { supabase: SupabaseClient; user: User };

/**
 * Verifica no SERVIDOR quem está logado e se é a administradora.
 *  - getUser() valida o token junto ao Supabase Auth (não confia só no cookie);
 *  - a tabela admins (protegida por RLS) diz se a conta tem acesso ao painel.
 * Esconder botões na interface NÃO é a proteção: além desta verificação, toda
 * leitura/escrita passa pelas políticas RLS do banco.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  return { supabase, user };
});

/** Para páginas do painel: redireciona ao login se não for a administradora. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Para Server Actions: lança erro (sem redirecionar) se não for a administradora. */
export async function assertAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("FORBIDDEN");
  return session;
}
