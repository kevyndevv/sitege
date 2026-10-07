import Image from "next/image";
import Link from "next/link";
import { publicImageUrl } from "@/lib/supabase/config";
import type { BusinessSettings } from "@/lib/types";
import { UserIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CartButton } from "./CartButton";

export function siteName(settings: BusinessSettings): string {
  return settings.business_name?.trim() || "Doces e salgados por encomenda";
}

export function SiteHeader({ settings }: { settings: BusinessSettings }) {
  const logo = publicImageUrl(settings.logo_path);
  const name = siteName(settings);
  return (
    <header className="sticky top-0 z-30 border-b border-linha/70 bg-acucar/95 backdrop-blur supports-[backdrop-filter]:bg-acucar/80">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={`${name}, página inicial`}>
          {logo ? (
            <Image src={logo} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
          ) : null}
          <span className="font-display truncate text-xl text-tinta sm:text-2xl">{name}</span>
        </Link>
        <nav aria-label="Principal" className="flex shrink-0 items-center gap-1">
          <Link href="/pedido" className="hidden h-11 items-center rounded-full px-3 font-bold text-tinta hover:bg-veu md:inline-flex">
            Cardápio
          </Link>
          <Link
            href="/acompanhar"
            className="hidden h-11 items-center rounded-full px-3 font-bold text-tinta hover:bg-veu md:inline-flex"
          >
            Acompanhar pedido
          </Link>
          <CartButton />
          <ThemeToggle />
          <Link
            href="/admin"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-suave hover:bg-veu hover:text-tinta"
            aria-label="Área da dona"
            title="Área da dona"
          >
            <UserIcon className="h-5 w-5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
