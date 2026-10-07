import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Young_Serif } from "next/font/google";
import { getSettings } from "@/lib/data/public";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Young Serif: títulos com cara de receita de família.
// Atkinson Hyperlegible: criada para máxima legibilidade, ótima para quem
// tem pouca familiaridade com tecnologia ou enxerga com dificuldade.
const display = Young_Serif({
  variable: "--font-young-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const sans = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { data: settings } = await getSettings();
  const name = settings.business_name?.trim() || "Doces e salgados por encomenda";
  const description =
    settings.hero_text?.trim() ||
    "Doces e salgados feitos em casa, por encomenda. Escolha os produtos e faça seu pedido pelo site.";
  return {
    title: { default: name, template: `%s | ${name}` },
    description,
    applicationName: name,
    openGraph: { title: name, description, locale: "pt_BR", type: "website" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#75616b" },
    { media: "(prefers-color-scheme: dark)", color: "#3e3238" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o tema (data-theme) é aplicado antes do React carregar.
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
