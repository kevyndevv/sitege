const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(cents: number): string {
  return brl.format(cents / 100);
}

/** "12,50" | "12.50" | "R$ 1.234,56" → centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [reais, centavos = ""] = normalized.split(".");
  return Number(reais) * 100 + Number(centavos.padEnd(2, "0"));
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** (11) 98888-7777 */
export function formatPhone(digits: string): string {
  const d = onlyDigits(digits);
  const local = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return d;
}

const TIME_ZONE = "America/Sao_Paulo";

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** "2026-10-12" → "segunda-feira, 12 de outubro" */
export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "2026-10-12" → "12/10/2026" */
export function formatDateShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/** "15:30:00" → "15h30" */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [h, min] = time.split(":");
  return min === "00" ? `${Number(h)}h` : `${Number(h)}h${min}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const day = todayInSaoPaulo(new Date(iso));
  const today = todayInSaoPaulo(now);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  if (day === today) return `hoje, ${time}`;
  if (day === addDays(today, -1)) return `ontem, ${time}`;
  return `${formatDateShort(day)}, ${time}`;
}
