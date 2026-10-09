/**
 * Antecedência mínima de um pedido.
 *
 * Vale a MAIOR entre a antecedência geral (Configurações) e a de cada
 * categoria dos produtos escolhidos. Ex.: geral 1 dia, "Bolos" 3 dias →
 * um pedido com bolo e docinho precisa de 3 dias.
 *
 * Usado no navegador (prévia) e no servidor; o banco confere de novo em
 * create_order, então esta conta nunca é a palavra final.
 */
import type { CatalogProduct, Category } from "./types";

export type LeadTime = {
  /** Dias mínimos de antecedência (0 = pode pedir para hoje). */
  days: number;
  /** Categorias que exigem esse prazo, quando ele é maior que o geral. */
  categories: string[];
};

export function orderLeadTime(
  generalDays: number | null,
  productIds: readonly string[],
  products: readonly Pick<CatalogProduct, "id" | "category_id">[],
  categories: readonly Pick<Category, "id" | "name" | "min_lead_days">[],
): LeadTime {
  const general = generalDays ?? 0;
  const productById = new Map(products.map((p) => [p.id, p]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const used = new Map<string, { name: string; days: number }>();
  for (const id of productIds) {
    const categoryId = productById.get(id)?.category_id;
    const category = categoryId ? categoryById.get(categoryId) : undefined;
    if (category && category.min_lead_days !== null) {
      used.set(category.id, { name: category.name, days: category.min_lead_days });
    }
  }

  const days = Math.max(general, ...[...used.values()].map((c) => c.days));
  const names = days > general ? [...used.values()].filter((c) => c.days === days).map((c) => c.name) : [];
  return { days, categories: names };
}

/** "1 dia" / "3 dias". */
export function daysLabel(days: number): string {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

/** "Bolos", "Bolos e Tortas", "Bolos, Tortas e Doces". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
