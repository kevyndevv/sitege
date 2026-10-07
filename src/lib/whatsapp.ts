import { onlyDigits } from "./format";

/** Link wa.me para um número brasileiro (adiciona 55 quando falta). */
export function whatsappLink(phone: string, message?: string): string {
  let digits = onlyDigits(phone);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function instagramLink(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle.replace(/^@/, ""))}/`;
}

/**
 * Mensagem de "pedido pronto" (texto aprovado pelo responsável). Serve tanto
 * para retirada quanto para entrega. Se o nome do negócio não estiver
 * configurado, a linha "Aqui é ..." é omitida.
 */
export function readyMessage(opts: {
  customerName: string;
  businessName: string | null;
  orderNumber: string;
  totalFormatted: string;
}): string {
  const firstName = opts.customerName.trim().split(/\s+/)[0] ?? "";
  const business = opts.businessName?.trim();
  return [
    `Olá, ${firstName}! 😊`,
    business
      ? `Aqui é ${business}. Seu pedido nº ${opts.orderNumber} já está prontinho! 🎉`
      : `Seu pedido nº ${opts.orderNumber} já está prontinho! 🎉`,
    "",
    "📍 Se for retirada, pode vir buscar quando quiser.",
    "🛵 Se for entrega, ele já já sai para o seu endereço.",
    "",
    `Valor do pedido: ${opts.totalFormatted}`,
    "Qualquer dúvida, é só responder esta mensagem. Obrigada pela preferência! 💕",
  ].join("\n");
}
