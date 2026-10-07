"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsField } from "@/actions/admin-settings";
import { centsToInput, formatPhone } from "@/lib/format";
import type { BusinessSettings } from "@/lib/types";
import { Spinner } from "@/components/ui/Spinner";
import { ImagePicker } from "./ImagePicker";

type Props = {
  settings: BusinessSettings;
  logoUrl: string | null;
  heroUrl: string | null;
};

type ImageState = { file: File | null; removed: boolean };

export function SettingsForm({ settings, logoUrl, heroUrl }: Props) {
  const [state, formAction, pending] = useActionState(saveSettings, null);
  const [logo, setLogo] = useState<ImageState>({ file: null, removed: false });
  const [hero, setHero] = useState<ImageState>({ file: null, removed: false });
  const errors = state?.fieldErrors ?? {};

  const field = (
    name: SettingsField,
    label: string,
    opts: {
      value: string | null | undefined;
      hint?: string;
      multiline?: boolean;
      max?: number;
      placeholder?: string;
      inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
      type?: string;
    },
  ) => (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      {opts.multiline ? (
        <textarea
          id={name}
          name={name}
          maxLength={opts.max}
          defaultValue={opts.value ?? ""}
          placeholder={opts.placeholder}
          className="input"
          aria-invalid={errors[name] ? true : undefined}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={opts.type ?? "text"}
          maxLength={opts.max}
          inputMode={opts.inputMode}
          defaultValue={opts.value ?? ""}
          placeholder={opts.placeholder}
          className="input"
          aria-invalid={errors[name] ? true : undefined}
        />
      )}
      {opts.hint ? <span className="field-hint">{opts.hint}</span> : null}
      {errors[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );

  return (
    <form
      action={(formData) => {
        if (logo.file) formData.set("logo", logo.file);
        if (logo.removed) formData.set("remove_logo", "1");
        if (hero.file) formData.set("hero_image", hero.file);
        if (hero.removed) formData.set("remove_hero_image", "1");
        formAction(formData);
      }}
      className="space-y-8"
      noValidate
    >
      <Section title="Encomendas pelo site">
        <Toggle
          name="accepting_orders"
          defaultChecked={settings.accepting_orders}
          title="Estou recebendo encomendas"
          text="Desmarque para pausar os pedidos (férias, agenda cheia). O cardápio continua visível."
        />
        {field("closed_message", "Mensagem quando os pedidos estiverem pausados", {
          value: settings.closed_message,
          max: 300,
          multiline: true,
          placeholder: "Ex.: Estamos de férias até dia 20. Voltamos logo!",
        })}

        <fieldset className="space-y-3">
          <legend className="field-label">Como os clientes podem receber</legend>
          <Toggle name="offers_pickup" defaultChecked={settings.offers_pickup} title="Retirada" text="O cliente busca o pedido." />
          <Toggle name="offers_delivery" defaultChecked={settings.offers_delivery} title="Entrega" text="Você leva até o cliente." />
          <span className="field-hint">Marque pelo menos uma opção para o site aceitar pedidos.</span>
        </fieldset>

        <div className="grid gap-5 md:grid-cols-2">
          {field("pickup_info", "Informações de retirada", {
            value: settings.pickup_info,
            max: 400,
            multiline: true,
            placeholder: "Endereço ou bairro, horários para retirar…",
          })}
          {field("delivery_info", "Informações de entrega", {
            value: settings.delivery_info,
            max: 400,
            multiline: true,
            placeholder: "Bairros atendidos, dias de entrega…",
          })}
          {field("delivery_fee", "Taxa única de entrega (R$)", {
            value: centsToInput(settings.delivery_fee_cents),
            inputMode: "decimal",
            placeholder: "Ex.: 8,00",
            hint: "Só é usada quando não há locais de entrega ativos (veja acima). Em branco = “a combinar”; 0 = grátis.",
          })}
          {field("min_lead_days", "Antecedência mínima (dias)", {
            value: settings.min_lead_days === null ? "" : String(settings.min_lead_days),
            inputMode: "numeric",
            placeholder: "Ex.: 2",
            hint: "Quantos dias antes o cliente precisa pedir. Em branco = pode pedir para hoje.",
          })}
        </div>
        {field("order_notice", "Aviso na finalização do pedido", {
          value: settings.order_notice,
          max: 400,
          multiline: true,
          placeholder: "Ex.: Pagamento na retirada, por Pix ou dinheiro.",
        })}
      </Section>

      <Section title="Seu negócio">
        <div className="grid gap-5 md:grid-cols-2">
          {field("business_name", "Nome do negócio", { value: settings.business_name, max: 80 })}
          {field("city", "Cidade / bairro", { value: settings.city, max: 120 })}
        </div>
        {field("hero_title", "Frase de destaque da página inicial", {
          value: settings.hero_title,
          max: 120,
          placeholder: "Ex.: Doces e salgados feitos em casa, sob encomenda",
        })}
        {field("hero_text", "Texto de apresentação", { value: settings.hero_text, max: 600, multiline: true })}
        {field("about_text", "Sobre (aparece no rodapé)", { value: settings.about_text, max: 1200, multiline: true })}
        {field("opening_hours", "Horário de atendimento", {
          value: settings.opening_hours,
          max: 300,
          multiline: true,
          placeholder: "Ex.: Terça a sábado, das 9h às 18h",
        })}
        <div className="grid gap-6 md:grid-cols-2">
          <ImagePicker
            label="Logo (opcional)"
            currentUrl={logoUrl}
            aspect="aspect-square"
            maxSide={512}
            error={errors.logo}
            onChange={(file, removed) => setLogo({ file, removed })}
          />
          <ImagePicker
            label="Foto da página inicial"
            currentUrl={heroUrl}
            aspect="aspect-[4/5]"
            error={errors.hero_image}
            onChange={(file, removed) => setHero({ file, removed })}
          />
        </div>
      </Section>

      <Section title="Contato e redes sociais">
        <div className="grid gap-5 md:grid-cols-2">
          {field("whatsapp_number", "WhatsApp", {
            value: settings.whatsapp_number ? formatPhone(settings.whatsapp_number) : "",
            type: "tel",
            inputMode: "tel",
            placeholder: "(11) 98888-7777",
          })}
          {field("instagram_handle", "Instagram", {
            value: settings.instagram_handle ? `@${settings.instagram_handle}` : "",
            placeholder: "@seuperfil",
          })}
          {field("contact_email", "E-mail de contato (opcional)", { value: settings.contact_email, type: "email", max: 120 })}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-linha bg-acucar/95 px-4 py-4 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:rounded-2xl sm:border">
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Salvando…
            </>
          ) : (
            "Salvar configurações"
          )}
        </button>
        {state ? (
          <p role={state.ok ? "status" : "alert"} className={`font-bold ${state.ok ? "text-ok" : "text-erro"}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <h2 className="font-display text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ name, defaultChecked, title, text }: { name: string; defaultChecked: boolean; title: string; text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-veu/70 p-4">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 shrink-0 accent-[#75616b]" />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="text-suave">{text}</span>
      </span>
    </label>
  );
}
