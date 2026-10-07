"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatMoney, formatPhone } from "@/lib/format";
import { rememberPhoneForTracking } from "@/lib/my-orders-store";
import { whatsappLink } from "@/lib/whatsapp";
import { CheckIcon, ChatIcon } from "@/components/icons";

type Props = {
  orderNumber: string;
  totalCents: number;
  hasPendingValues: boolean;
  businessName: string;
  whatsapp: string | null;
  /** Telefone informado no pedido (usado para acompanhar). */
  phone: string;
};

export function OrderSuccess({ orderNumber, totalCents, hasPendingValues, businessName, whatsapp, phone }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card overflow-hidden">
        <div className="bg-ok-fundo px-6 py-8 text-center sm:px-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok text-acucar">
            <CheckIcon className="h-9 w-9" />
          </span>
          <h1 ref={headingRef} tabIndex={-1} className="font-display mt-4 text-3xl text-calda outline-none sm:text-4xl">
            Pedido recebido!
          </h1>
          <p className="mt-2 text-lg text-calda">
            Seu pedido foi registrado e agora está <strong>aguardando a confirmação</strong> de {businessName}.
          </p>
        </div>

        <div className="space-y-6 px-6 py-7 sm:px-10">
          <div className="rounded-2xl bg-veu p-5">
            <p className="text-sm font-bold text-suave">Número do pedido</p>
            <p className="font-display mt-1 text-3xl tracking-wider">{orderNumber}</p>
          </div>

          <p className="text-lg">
            Para acompanhar, é só abrir <strong>Acompanhar pedido</strong> e digitar o seu telefone:{" "}
            <strong className="whitespace-nowrap">{formatPhone(phone)}</strong>.
          </p>

          <p className="text-lg">
            Valor do pedido: <strong>{formatMoney(totalCents)}</strong>
            {hasPendingValues ? (
              <span className="block text-base text-suave">Itens ou taxas a combinar serão informados na confirmação.</span>
            ) : null}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/acompanhar" className="btn btn-primary" onClick={() => rememberPhoneForTracking(phone)}>
              Acompanhar meu pedido
            </Link>
            {whatsapp ? (
              <a
                className="btn btn-outline"
                target="_blank"
                rel="noopener noreferrer"
                href={whatsappLink(whatsapp, `Olá! Acabei de fazer o pedido ${orderNumber} pelo site.`)}
              >
                <ChatIcon className="h-5 w-5" />
                Avisar pelo WhatsApp
              </a>
            ) : null}
          </div>
          <Link href="/" className="inline-block font-bold text-tinta underline underline-offset-4">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
