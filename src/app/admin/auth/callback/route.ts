import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Retorno dos links enviados por e-mail (ex.: "esqueci minha senha").
 * Só redireciona para páginas internas do painel (evita redirecionamento aberto).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next") ?? "/admin";
  const next = /^\/admin(\/[a-z0-9-/]*)?$/i.test(nextParam) && !nextParam.includes("//") ? nextParam : "/admin";

  const supabase = await getServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const target = new URL(ok ? next : "/admin/login?link=expirado", origin);
  return NextResponse.redirect(target);
}
