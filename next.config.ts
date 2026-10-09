import os from "node:os";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Host do Supabase (para liberar as fotos do Storage em next/image e na CSP). */
function supabaseOrigin(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/i, "");
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

const supabase = supabaseOrigin();

/**
 * Endereços deste computador na rede local (ex.: 192.168.0.160).
 * Em desenvolvimento, o Next.js 16 bloqueia quem acessa por um endereço que não
 * seja "localhost" — por isso o site não funcionava ao testar pelo celular.
 * Liberamos só os IPs do próprio computador (e os de DEV_ALLOWED_ORIGINS, se
 * quiser adicionar outros, separados por vírgula). Não vale em produção.
 */
function localNetworkHosts(): string[] {
  const hosts = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const address of list ?? []) {
      const family = String(address.family);
      if (!address.internal && (family === "IPv4" || family === "4")) hosts.add(address.address);
    }
  }
  for (const extra of (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",")) {
    if (extra.trim()) hosts.add(extra.trim());
  }
  return [...hosts];
}

const contentSecurityPolicy = [
  "default-src 'self'",
  // O Next.js injeta scripts inline para hidratar a página.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabase ? ` ${supabase.origin}` : ""}`,
  "font-src 'self'",
  // O navegador não conversa direto com o Supabase: tudo passa pelo servidor.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isDev ? { allowedDevOrigins: localNetworkHosts() } : {}),
  images: {
    remotePatterns: supabase
      ? [
          {
            protocol: supabase.protocol.replace(":", "") as "https" | "http",
            hostname: supabase.hostname,
            pathname: "/storage/v1/object/public/site-images/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Painel e consulta: nunca enviar o endereço como "referência" para outros
      // sites. Usamos "same-origin" (e não "no-referrer") porque com
      // "no-referrer" os navegadores mandam a origem como "null" nos envios de
      // formulário, e o Next.js recusa o login por segurança.
      { source: "/acompanhar", headers: [{ key: "Referrer-Policy", value: "same-origin" }] },
      { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "same-origin" }] },
    ];
  },
};

export default nextConfig;
