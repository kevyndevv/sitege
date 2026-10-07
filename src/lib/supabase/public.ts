import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

let client: SupabaseClient | null = null;

/**
 * Cliente "anônimo" para leituras públicas e RPCs de clientes (sem cookies).
 * Tudo o que ele consegue fazer é limitado pela RLS para o papel `anon`.
 */
export function getPublicClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = requireSupabaseConfig();
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
