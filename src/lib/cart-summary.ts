import type { CartLine } from "./cart-store";
import type { CatalogProduct } from "./types";

export type ResolvedLine = {
  product: CatalogProduct;
  quantity: number;
  subtotalCents: number | null;
};

/**
 * Junta o carrinho (IDs + quantidades) com o catálogo ATUAL. Itens que não
 * estão mais disponíveis aparecem em `unavailable` para o cliente removê-los.
 * Este total é apenas uma prévia: o valor oficial é calculado no servidor.
 */
export function resolveCart(lines: CartLine[], products: CatalogProduct[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolved: ResolvedLine[] = [];
  const unavailable: CartLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      unavailable.push(line);
      continue;
    }
    resolved.push({
      product,
      quantity: line.quantity,
      subtotalCents: product.price_cents === null ? null : product.price_cents * line.quantity,
    });
  }
  const itemsTotal = resolved.reduce((sum, l) => sum + (l.subtotalCents ?? 0), 0);
  const hasUnpriced = resolved.some((l) => l.subtotalCents === null);
  const count = resolved.reduce((sum, l) => sum + l.quantity, 0);
  return { resolved, unavailable, itemsTotal, hasUnpriced, count };
}
