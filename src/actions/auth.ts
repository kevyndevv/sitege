"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";

export type FormMessage = { ok: boolean; message: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData): string {
  const value = formData.get("email");
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 200) : "";
}

/**
 * Login da dona. A senha é verificada pelo Supabase Auth (que guarda apenas o
 * hash bcrypt); este projeto nunca armazena senhas. Mensagens de erro são
 * genéricas para não revelar quais e-mails existem.
 */
export async function signIn(_prev: FormMessage, formData: FormData): Promise<FormMessage> {
  if (!isSupabaseConfigured()) return { ok: false, message: "O banco de dados ainda não foi configurado." };

  const email = readEmail(formData);
  const password = formData.get("password");
  if (!EMAIL_RE.test(email) || typeof password !== "string" || password.length < 6 || password.length > 200) {
    return { ok: false, message: "Informe seu e-mail e sua senha." };
  }

  const ip = await clientIp();
  if (hitRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000) || hitRateLimit(`login:email:${email}`, 6, 15 * 60 * 1000)) {
    return { ok: false, message: "Muitas tentativas seguidas. Aguarde 15 minutos e tente de novo." };
  }

  const supabase = await getServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, message: "E-mail ou senha incorretos." };
  }

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false, message: "Esta conta não tem acesso à área da dona." };
  }

  redirect("/admin");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getServerClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestPasswordReset(_prev: FormMessage, formData: FormData): Promise<FormMessage> {
  if (!isSupabaseConfigured()) return { ok: false, message: "O banco de dados ainda não foi configurado." };
  const email = readEmail(formData);
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Informe um e-mail válido." };

  const ip = await clientIp();
  if (hitRateLimit(`reset:${ip}`, 5, 60 * 60 * 1000)) {
    return { ok: false, message: "Muitas tentativas seguidas. Aguarde um pouco e tente de novo." };
  }

  const supabase = await getServerClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/admin/auth/callback?next=/admin/nova-senha`,
  });
  if (error) console.error("[reset] falha ao solicitar redefinição:", error.code ?? error.status);

  // Mesma resposta sempre: não revela se o e-mail tem conta.
  return {
    ok: true,
    message: "Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha. Confira também o spam.",
  };
}

export async function updatePassword(_prev: FormMessage, formData: FormData): Promise<FormMessage> {
  if (!isSupabaseConfigured()) return { ok: false, message: "O banco de dados ainda não foi configurado." };
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || password.length < 10 || password.length > 200) {
    return { ok: false, message: "A senha precisa ter pelo menos 10 caracteres." };
  }
  if (password !== confirm) return { ok: false, message: "As duas senhas não são iguais." };

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "O link expirou. Peça um novo link de redefinição." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return {
      ok: false,
      message:
        error.code === "weak_password"
          ? "Essa senha é fraca demais. Use uma frase ou misture letras, números e símbolos."
          : error.code === "same_password"
            ? "A nova senha precisa ser diferente da anterior."
            : "Não foi possível alterar a senha agora. Tente novamente.",
    };
  }
  redirect("/admin");
}
