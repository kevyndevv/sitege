import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Cliente com a sessão da pessoa logada (cookies). Usado no painel da dona.
 * As permissões efetivas continuam sendo decididas pela RLS no banco.
 */
export async function getServerClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS });
          }
        } catch {
          // Chamado a partir de um Server Component (somente leitura): o proxy
          // (src/proxy.ts) já cuida de renovar os cookies da sessão.
        }
      },
    },
  });
}
