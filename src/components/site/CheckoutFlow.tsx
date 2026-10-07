"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createOrder } from "@/actions/orders";
import { clearCart, removeFromCart, setQuantity, useCart } from "@/lib/cart-store";
import { resolveCart } from "@/lib/cart-summary";
import { addDays, formatDateLong, formatMoney, formatTime } from "@/lib/format";
import type { BusinessSettings, CatalogProduct, DeliveryZone, FulfillmentType } from "@/lib/types";
import { randomUuid } from "@/lib/uuid";
import {
  DEFINITIVE_ORDER_ERRORS,
  LIMITS,
  validateCheckout,
  type CheckoutField,
  type CheckoutInput,
  type FieldErrors,
} from "@/lib/validation";
import { ArrowLeftIcon, TrashIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { OrderSuccess } from "./OrderSuccess";
import { PriceTag } from "./PriceTag";
import { QuantityStepper } from "./QuantityStepper";

type Props = {
  products: CatalogProduct[];
  settings: BusinessSettings;
  /** Locais de entrega ativos (cada um com sua taxa). Vazio = taxa única. */
  zones: DeliveryZone[];
  businessName: string;
  /** Data de hoje (fuso de Brasília), calculada no servidor. */
  today: string;
};

type FormState = Omit<CheckoutInput, "items" | "idempotencyKey">;

type Success = { orderNumber: string; totalCents: number; hasPendingValues: boolean; phone: string };

const FIELD_ORDER: CheckoutField[] = [
  "items",
  "customerName",
  "customerPhone",
  "fulfillmentType",
  "deliveryZoneId",
  "deliveryAddress",
  "requestedDate",
  "requestedTime",
  "notes",
];

export function CheckoutFlow({ products, settings, zones, businessName, today }: Props) {
  const lines = useCart();
  const cart = resolveCart(lines, products);

  const onlyOption: FulfillmentType | "" =
    settings.offers_pickup && !settings.offers_delivery
      ? "pickup"
      : settings.offers_delivery && !settings.offers_pickup
        ? "delivery"
        : "";

  const [form, setForm] = useState<FormState>({
    customerName: "",
    customerPhone: "",
    fulfillmentType: onlyOption,
    deliveryZoneId: "",
    deliveryAddress: "",
    requestedDate: "",
    requestedTime: "",
    notes: "",
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [isPending, startTransition] = useTransition();

  // Mesma chave em reenvios do mesmo pedido: o servidor não duplica.
  const idempotencyKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const minDate = addDays(today, settings.min_lead_days ?? 0);
  const maxDate = addDays(today, LIMITS.maxDaysAhead);
  const rules = {
    offersPickup: settings.offers_pickup,
    offersDelivery: settings.offers_delivery,
    minLeadDays: settings.min_lead_days,
    zoneIds: zones.map((z) => z.id),
  };

  const isDelivery = form.fulfillmentType === "delivery";
  const usesZones = zones.length > 0;
  const zone = zones.find((z) => z.id === form.deliveryZoneId) ?? null;
  // Taxa mostrada é só prévia: o valor oficial é calculado no banco.
  const deliveryFee: number | null = !isDelivery ? 0 : usesZones ? (zone?.fee_cents ?? null) : settings.delivery_fee_cents;
  const feeToCombine = isDelivery && !usesZones && settings.delivery_fee_cents === null;
  const total = cart.itemsTotal + (deliveryFee ?? 0);
  const hasPendingValues = cart.hasUnpriced || feeToCombine;

  if (success) {
    return (
      <OrderSuccess
        {...success}
        businessName={businessName}
        whatsapp={settings.whatsapp_number}
      />
    );
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as CheckoutField]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key as CheckoutField];
        return next;
      });
    }
  }

  function buildInput(): CheckoutInput {
    return {
      ...form,
      idempotencyKey: idempotencyKey.current ?? "00000000-0000-4000-8000-000000000000",
      items: cart.resolved.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    };
  }

  function focusFirstError(found: FieldErrors) {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (!first) return;
    window.requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  }

  function goToReview(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const found = validateCheckout(buildInput(), rules);
    if (cart.unavailable.length > 0) {
      found.items = "Remova os itens que não estão mais disponíveis.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function confirmOrder() {
    if (submitting.current) return; // evita envio duplo
    submitting.current = true;
    setSubmitError(null);
    if (!idempotencyKey.current) idempotencyKey.current = randomUuid();
    const input = buildInput();

    startTransition(async () => {
      try {
        const result = await createOrder(input);
        if (result.ok) {
          clearCart();
          idempotencyKey.current = null;
          setSuccess({
            orderNumber: result.orderNumber,
            totalCents: result.totalCents,
            hasPendingValues,
            phone: form.customerPhone,
          });
          return;
        }
        // Erro definitivo: um novo envio (após correção) deve usar nova chave.
        if (DEFINITIVE_ORDER_ERRORS.has(result.code)) idempotencyKey.current = null;
        setSubmitError(result.message);
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          setStep("edit");
          focusFirstError(result.fieldErrors);
        }
      } catch {
        // Falha de rede: mantemos a mesma chave para o reenvio não duplicar.
        setSubmitError("Não foi possível falar com o servidor. Verifique sua internet e toque em enviar de novo.");
      } finally {
        submitting.current = false;
      }
    });
  }

  if (cart.resolved.length === 0 && cart.unavailable.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-14 text-center">
        <h1 className="font-display text-3xl text-tinta">Seu pedido ainda está vazio.</h1>
        <p className="text-suave">Escolha os produtos no cardápio e volte aqui para finalizar.</p>
        <Link href="/pedido" className="btn btn-primary">
          Ver o cardápio
        </Link>
      </div>
    );
  }

  const summaryBlock = (
    <div className="space-y-2 border-t border-linha pt-4">
      {isDelivery ? (
        <div className="flex justify-between gap-4 text-suave">
          <span>Taxa de entrega{zone ? ` (${zone.name})` : ""}</span>
          <span>
            {deliveryFee === null
              ? usesZones
                ? "escolha o local"
                : "a combinar"
              : deliveryFee === 0
                ? "grátis"
                : formatMoney(deliveryFee)}
          </span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-lg font-bold">Total</span>
        <span className="font-display text-2xl">{formatMoney(total)}</span>
      </div>
      {hasPendingValues ? (
        <p className="text-sm text-suave">
          Há valores a combinar. {businessName} informa o valor final ao confirmar o pedido.
        </p>
      ) : (
        <p className="text-sm text-suave">O valor final é conferido pelo sistema ao enviar.</p>
      )}
    </div>
  );

  if (step === "review") {
    return (
      <div className="mx-auto max-w-2xl">
        <button type="button" className="btn btn-ghost -ml-3 mb-4" onClick={() => setStep("edit")}>
          <ArrowLeftIcon className="h-5 w-5" />
          Corrigir pedido
        </button>
        <h1 className="font-display text-3xl sm:text-4xl">Confira seu pedido</h1>
        <p className="mt-2 text-suave">Se estiver tudo certo, toque em “Enviar pedido”.</p>

        <div className="card mt-6 space-y-6 p-5 sm:p-7">
          <section aria-labelledby="rev-itens">
            <h2 id="rev-itens" className="text-lg font-bold">
              Produtos
            </h2>
            <ul className="mt-3 divide-y divide-linha">
              {cart.resolved.map((l) => (
                <li key={l.product.id} className="flex justify-between gap-4 py-2.5">
                  <span>
                    <strong>{l.quantity}×</strong> {l.product.name}
                    {l.product.unit_label ? <span className="text-suave"> ({l.product.unit_label})</span> : null}
                  </span>
                  <span className="shrink-0">{l.subtotalCents === null ? "a combinar" : formatMoney(l.subtotalCents)}</span>
                </li>
              ))}
            </ul>
            {summaryBlock}
          </section>

          <section aria-labelledby="rev-dados" className="border-t border-linha pt-5">
            <h2 id="rev-dados" className="text-lg font-bold">
              Seus dados
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <ReviewItem label="Nome" value={form.customerName.trim()} />
              <ReviewItem label="Telefone / WhatsApp" value={form.customerPhone} />
              <ReviewItem label="Como receber" value={isDelivery ? "Entrega no endereço" : "Retirada"} />
              <ReviewItem
                label="Para quando"
                value={`${formatDateLong(form.requestedDate)}${form.requestedTime ? `, às ${formatTime(form.requestedTime)}` : ""}`}
              />
              {isDelivery && zone ? <ReviewItem label="Local de entrega" value={zone.name} /> : null}
              {isDelivery ? <ReviewItem label="Endereço" value={form.deliveryAddress.trim()} wide /> : null}
              {form.notes.trim() ? <ReviewItem label="Observações" value={form.notes.trim()} wide /> : null}
            </dl>
          </section>
        </div>

        {submitError ? (
          <p role="alert" className="mt-5 rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
            {submitError}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-outline" onClick={() => setStep("edit")} disabled={isPending}>
            Corrigir pedido
          </button>
          <button type="button" className="btn btn-primary min-h-14 px-8 text-lg" onClick={confirmOrder} disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <>
                <Spinner /> Enviando…
              </>
            ) : (
              "Enviar pedido"
            )}
          </button>
        </div>
      </div>
    );
  }

  const fieldProps = (field: CheckoutField) => ({
    "data-field": field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-erro` : undefined,
  });

  return (
    <>
    <h1 className="font-display mb-8 text-4xl text-calda sm:text-5xl">Finalizar pedido</h1>
    <form ref={formRef} onSubmit={goToReview} noValidate className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-8">
        {/* 1. Produtos */}
        <section aria-labelledby="sec-itens" className="card p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 id="sec-itens" className="font-display text-2xl">
              Seu pedido
            </h2>
            <Link href="/pedido" className="btn btn-ghost btn-sm">
              Adicionar mais
            </Link>
          </div>

          {cart.unavailable.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-alerta-fundo p-4 text-alerta">
              <p className="font-bold">
                {cart.unavailable.length === 1
                  ? "Um produto do seu pedido não está mais disponível."
                  : `${cart.unavailable.length} produtos do seu pedido não estão mais disponíveis.`}
              </p>
              <button
                type="button"
                className="btn btn-sm mt-2 bg-glace text-alerta"
                onClick={() => cart.unavailable.forEach((l) => removeFromCart(l.productId))}
              >
                Remover do pedido
              </button>
            </div>
          ) : null}

          <ul className="mt-4 divide-y divide-linha" data-field="items" tabIndex={-1} aria-describedby={errors.items ? "items-erro" : undefined}>
            {cart.resolved.map((l) => (
              <li key={l.product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold">{l.product.name}</p>
                  <PriceTag cents={l.product.price_cents} unit={l.product.unit_label} className="text-sm" />
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <QuantityStepper
                    value={l.quantity}
                    min={1}
                    onChange={(q) => setQuantity(l.product.id, q)}
                    label={l.product.name}
                  />
                  <span className="w-24 text-right font-bold">
                    {l.subtotalCents === null ? "a combinar" : formatMoney(l.subtotalCents)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-suave hover:bg-erro-fundo hover:text-erro"
                    onClick={() => removeFromCart(l.product.id)}
                    aria-label={`Remover ${l.product.name} do pedido`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {errors.items ? (
            <p id="items-erro" className="field-error">
              {errors.items}
            </p>
          ) : null}
        </section>

        {/* 2. Dados */}
        <section aria-labelledby="sec-dados" className="card space-y-5 p-5 sm:p-7">
          <h2 id="sec-dados" className="font-display text-2xl">
            Seus dados
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="customerName" className="field-label">
                Seu nome
              </label>
              <input
                id="customerName"
                className="input"
                autoComplete="name"
                maxLength={LIMITS.nameMax}
                value={form.customerName}
                onChange={(e) => update("customerName", e.target.value)}
                {...fieldProps("customerName")}
              />
              <FieldError field="customerName" errors={errors} />
            </div>
            <div>
              <label htmlFor="customerPhone" className="field-label">
                Telefone ou WhatsApp
              </label>
              <input
                id="customerPhone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(11) 98888-7777"
                maxLength={20}
                value={form.customerPhone}
                onChange={(e) => update("customerPhone", e.target.value)}
                {...fieldProps("customerPhone")}
              />
              <FieldError field="customerPhone" errors={errors} />
            </div>
          </div>

          {/* Armadilha para robôs: invisível para pessoas e leitores de tela. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="website">Não preencha este campo</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
            />
          </div>
        </section>

        {/* 3. Entrega/retirada e data */}
        <section aria-labelledby="sec-entrega" className="card space-y-5 p-5 sm:p-7">
          <h2 id="sec-entrega" className="font-display text-2xl">
            Como e quando
          </h2>

          <fieldset data-field="fulfillmentType" tabIndex={-1} aria-describedby={errors.fulfillmentType ? "fulfillmentType-erro" : undefined}>
            <legend className="field-label">Como você quer receber?</legend>
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              {settings.offers_pickup ? (
                <FulfillmentOption
                  value="pickup"
                  checked={form.fulfillmentType === "pickup"}
                  onChange={() => update("fulfillmentType", "pickup")}
                  title="Retirar"
                  detail={settings.pickup_info}
                />
              ) : null}
              {settings.offers_delivery ? (
                <FulfillmentOption
                  value="delivery"
                  checked={form.fulfillmentType === "delivery"}
                  onChange={() => update("fulfillmentType", "delivery")}
                  title="Receber em casa"
                  detail={[
                    settings.delivery_info,
                    usesZones
                      ? "A taxa depende do local de entrega."
                      : settings.delivery_fee_cents === null
                        ? "Taxa de entrega a combinar."
                        : settings.delivery_fee_cents === 0
                          ? "Entrega grátis."
                          : `Taxa de entrega: ${formatMoney(settings.delivery_fee_cents)}.`,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ) : null}
            </div>
            <FieldError field="fulfillmentType" errors={errors} />
          </fieldset>

          {isDelivery && usesZones ? (
            <fieldset data-field="deliveryZoneId" tabIndex={-1} aria-describedby={errors.deliveryZoneId ? "deliveryZoneId-erro" : undefined}>
              <legend className="field-label">Onde é a entrega?</legend>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                {zones.map((z) => (
                  <label
                    key={z.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 p-4 transition-colors ${
                      form.deliveryZoneId === z.id ? "border-ameixa bg-veu" : "border-linha bg-glace hover:border-ameixa-clara"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="deliveryZoneId"
                        value={z.id}
                        checked={form.deliveryZoneId === z.id}
                        onChange={() => update("deliveryZoneId", z.id)}
                        className="h-5 w-5 shrink-0 accent-[#75616b]"
                      />
                      <span className="font-bold">{z.name}</span>
                    </span>
                    <span className="shrink-0 text-suave">{z.fee_cents === 0 ? "grátis" : formatMoney(z.fee_cents)}</span>
                  </label>
                ))}
              </div>
              <FieldError field="deliveryZoneId" errors={errors} />
            </fieldset>
          ) : null}

          {isDelivery ? (
            <div>
              <label htmlFor="deliveryAddress" className="field-label">
                Endereço de entrega
              </label>
              <textarea
                id="deliveryAddress"
                className="input min-h-24"
                autoComplete="street-address"
                maxLength={LIMITS.addressMax}
                placeholder="Rua, número, complemento, bairro e ponto de referência"
                value={form.deliveryAddress}
                onChange={(e) => update("deliveryAddress", e.target.value)}
                {...fieldProps("deliveryAddress")}
              />
              <FieldError field="deliveryAddress" errors={errors} />
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="requestedDate" className="field-label">
                Para qual dia?
              </label>
              <input
                id="requestedDate"
                type="date"
                className="input"
                min={minDate}
                max={maxDate}
                value={form.requestedDate}
                onChange={(e) => update("requestedDate", e.target.value)}
                {...fieldProps("requestedDate")}
              />
              {settings.min_lead_days ? (
                <span className="field-hint">
                  Pedimos {settings.min_lead_days} {settings.min_lead_days === 1 ? "dia" : "dias"} de antecedência.
                </span>
              ) : null}
              <FieldError field="requestedDate" errors={errors} />
            </div>
            <div>
              <label htmlFor="requestedTime" className="field-label">
                Horário <span className="font-normal text-suave">(opcional)</span>
              </label>
              <input
                id="requestedTime"
                type="time"
                className="input"
                value={form.requestedTime}
                onChange={(e) => update("requestedTime", e.target.value)}
                {...fieldProps("requestedTime")}
              />
              {settings.opening_hours ? (
                <span className="field-hint">Atendimento: {settings.opening_hours}</span>
              ) : null}
              <FieldError field="requestedTime" errors={errors} />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="field-label">
              Observações <span className="font-normal text-suave">(opcional)</span>
            </label>
            <textarea
              id="notes"
              className="input"
              maxLength={LIMITS.notesMax}
              placeholder="Ex.: sabor da massa, escrita no bolo, restrições alimentares"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              {...fieldProps("notes")}
            />
            <span className="field-hint">
              {form.notes.length}/{LIMITS.notesMax}
            </span>
            <FieldError field="notes" errors={errors} />
          </div>
        </section>
      </div>

      {/* Resumo lateral */}
      <aside className="card space-y-4 p-5 sm:p-7 lg:sticky lg:top-24" aria-label="Resumo do pedido">
        <h2 className="font-display text-2xl">Resumo</h2>
        <ul className="space-y-1.5">
          {cart.resolved.map((l) => (
            <li key={l.product.id} className="flex justify-between gap-3 text-[0.98rem]">
              <span>
                {l.quantity}× {l.product.name}
              </span>
              <span className="shrink-0 text-suave">
                {l.subtotalCents === null ? "a combinar" : formatMoney(l.subtotalCents)}
              </span>
            </li>
          ))}
        </ul>
        {summaryBlock}
        {settings.order_notice ? (
          <p className="rounded-2xl bg-veu p-4 text-[0.98rem] whitespace-pre-line">{settings.order_notice}</p>
        ) : null}
        {submitError ? (
          <p role="alert" className="rounded-2xl bg-erro-fundo px-4 py-3 font-bold text-erro">
            {submitError}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary w-full min-h-14 text-lg">
          Revisar pedido
        </button>
        <p className="text-center text-sm text-suave">Você ainda poderá conferir tudo antes de enviar.</p>
      </aside>
    </form>
    </>
  );
}

function FieldError({ field, errors }: { field: CheckoutField; errors: FieldErrors }) {
  if (!errors[field]) return null;
  return (
    <span id={`${field}-erro`} className="field-error" role="alert">
      {errors[field]}
    </span>
  );
}

function FulfillmentOption({
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  value: FulfillmentType;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string | null;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition-colors ${
        checked ? "border-ameixa bg-veu" : "border-linha bg-glace hover:border-ameixa-clara"
      }`}
    >
      <input
        type="radio"
        name="fulfillmentType"
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-5 w-5 shrink-0 accent-[#75616b]"
      />
      <span>
        <span className="block font-bold">{title}</span>
        {detail ? <span className="mt-0.5 block text-[0.95rem] text-suave whitespace-pre-line">{detail}</span> : null}
      </span>
    </label>
  );
}

function ReviewItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-bold text-suave">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words">{value}</dd>
    </div>
  );
}
