import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/config";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/** Rotas do painel acessíveis sem login. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/esqueci-senha", "/admin/auth/callback"];

function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Proxy (antigo "middleware"):
 *  1. Força HTTPS em produção.
 *  2. No painel (/admin), renova a sessão e manda para o login quem não está
 *     autenticado. A verificação de que a pessoa é ADMIN acontece de novo nas
 *     páginas e ações (src/lib/auth.ts) e no banco (RLS).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") ?? "";
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (process.env.NODE_ENV === "production" && forwardedProto === "http" && !isLocal) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (!supabaseConfig) return NextResponse.next(); // a página mostra o aviso de configuração

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicAdminPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Ignora arquivos estáticos e imagens otimizadas.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)"],
};
