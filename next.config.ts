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
      // A página de consulta recebe o segredo do pedido no endereço (#...):
      // nunca enviar esse endereço como "referência" para outros sites.
      { source: "/acompanhar", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
};

export default nextConfig;
