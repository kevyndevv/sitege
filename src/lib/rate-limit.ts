import "server-only";
import { headers } from "next/headers";

/**
 * Limitador simples em memória (janela deslizante) por IP.
 *
 * É uma camada extra, "melhor esforço": em hospedagens com várias instâncias
 * cada uma tem a própria contagem. As regras que realmente valem (2 pedidos por
 * dia / 5 por semana por cliente, limite geral contra robôs) ficam no banco,
 * dentro de create_order, e não podem ser contornadas.
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function hitRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > MAX_KEYS) {
    // Evita crescimento sem limite: descarta as chaves mais antigas.
    const excess = buckets.size - MAX_KEYS;
    let removed = 0;
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (++removed >= excess) break;
    }
  }
  return false;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "desconhecido";
}
