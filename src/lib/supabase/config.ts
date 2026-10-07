/**
 * Configuração pública do Supabase (URL do projeto e chave "anon"/publishable).
 *
 * Ambas são públicas por natureza: a segurança dos dados vem das políticas RLS
 * do banco. A chave service_role NUNCA é usada neste projeto.
 */

function normalizeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  // Aceita também a URL copiada com "/rest/v1/" no final (erro comum).
  value = value.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

const url = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  null;

export const supabaseConfig = url && anonKey ? { url, anonKey } : null;

export function isSupabaseConfigured(): boolean {
  return supabaseConfig !== null;
}

export function requireSupabaseConfig(): { url: string; anonKey: string } {
  if (!supabaseConfig) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.local",
    );
  }
  return supabaseConfig;
}

/** Bucket público onde ficam as fotos (ver migração SQL). */
export const IMAGES_BUCKET = "site-images";

/** URL pública de uma imagem guardada no Storage. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path || !supabaseConfig) return null;
  const safePath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseConfig.url}/storage/v1/object/public/${IMAGES_BUCKET}/${safePath}`;
}
