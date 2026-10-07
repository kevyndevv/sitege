import Link from "next/link";
import { formatPhone } from "@/lib/format";
import type { BusinessSettings } from "@/lib/types";
import { instagramLink, whatsappLink } from "@/lib/whatsapp";
import { AtIcon, ChatIcon, ClockIcon, PinIcon } from "@/components/icons";
import { siteName } from "./SiteHeader";

function currentYear(): number {
  return new Date().getFullYear();
}

export function SiteFooter({ settings }: { settings: BusinessSettings }) {
  const name = siteName(settings);
  const hasSocial = Boolean(settings.instagram_handle || settings.whatsapp_number);
  return (
    <footer className="mt-auto">
      <div className="scallop-up" aria-hidden="true" />
      <div className="bg-ameixa-funda text-white">
        <div className="container-page grid gap-10 py-12 md:grid-cols-[1.3fr_1fr]">
          <div className="max-w-md">
            <p className="font-display text-2xl">{name}</p>
            {settings.about_text ? <p className="mt-3 text-white/85">{settings.about_text}</p> : null}
            <ul className="mt-5 space-y-2 text-white/85">
              {settings.city ? (
                <li className="flex items-start gap-2">
                  <PinIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{settings.city}</span>
                </li>
              ) : null}
              {settings.opening_hours ? (
                <li className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-5 w-5 shrink-0" />
                  <span className="whitespace-pre-line">{settings.opening_hours}</span>
                </li>
              ) : null}
              {settings.contact_email ? (
                <li>
                  <a className="underline underline-offset-4 hover:text-white" href={`mailto:${settings.contact_email}`}>
                    {settings.contact_email}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            {settings.whatsapp_number ? (
              <a
                href={whatsappLink(settings.whatsapp_number, "Olá! Vim pelo site e gostaria de falar sobre uma encomenda.")}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-light w-full md:w-auto"
              >
                <ChatIcon className="h-5 w-5" />
                Conversar pelo WhatsApp
              </a>
            ) : null}
            {settings.instagram_handle ? (
              <a
                href={instagramLink(settings.instagram_handle)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full border-2 border-white/60 text-white hover:bg-white/10 md:w-auto"
              >
                <AtIcon className="h-5 w-5" />
                Instagram @{settings.instagram_handle.replace(/^@/, "")}
              </a>
            ) : null}
            {settings.whatsapp_number ? (
              <p className="text-white/75 md:text-right">WhatsApp {formatPhone(settings.whatsapp_number)}</p>
            ) : null}
            {!hasSocial ? <p className="text-white/75 md:text-right">Faça seu pedido pelo site.</p> : null}
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="container-page flex flex-col gap-2 py-5 text-sm text-white/70 sm:flex-row sm:justify-between">
            <p>
              © {currentYear()} {name}
            </p>
            <nav aria-label="Rodapé" className="flex gap-4">
              <Link href="/pedido" className="hover:text-white">
                Cardápio
              </Link>
              <Link href="/acompanhar" className="hover:text-white">
                Acompanhar pedido
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
