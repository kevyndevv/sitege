import "server-only";
import { addDays, todayInSaoPaulo } from "@/lib/format";

export const PAGE_SIZE = 20;

/** Início do dia (00:00 em Brasília) em ISO. O Brasil não usa horário de verão desde 2019. */
export function startOfDaySP(isoDate: string): string {
  return `${isoDate}T00:00:00-03:00`;
}

export type Period = "hoje" | "7dias" | "30dias";

export function periodRange(period: Period, now: Date = new Date()): { from: string; to: string; label: string } {
  const today = todayInSaoPaulo(now);
  const to = startOfDaySP(addDays(today, 1));
  switch (period) {
    case "hoje":
      return { from: startOfDaySP(today), to, label: "hoje" };
    case "30dias":
      return { from: startOfDaySP(addDays(today, -29)), to, label: "nos últimos 30 dias" };
    default:
      return { from: startOfDaySP(addDays(today, -6)), to, label: "nos últimos 7 dias" };
  }
}

export function parsePeriod(value: unknown): Period {
  return value === "hoje" || value === "30dias" ? value : "7dias";
}

export function parsePage(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/** Escapa curingas do LIKE para buscar o texto literalmente. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type AdminStats = {
  by_status: Partial<Record<string, number>>;
  open_by_status: Partial<Record<string, number>>;
  orders_in_period: number;
  revenue_cents: number;
  top_products: { name: string; quantity: number; orders: number }[];
};

