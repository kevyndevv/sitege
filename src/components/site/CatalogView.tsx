"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import { resolveCart } from "@/lib/cart-summary";
import { formatMoney } from "@/lib/format";
import type { CatalogProduct, Category } from "@/lib/types";
import { BagIcon } from "@/components/icons";
import { ProductCard } from "./ProductCard";

type Props = {
  products: CatalogProduct[];
  categories: Category[];
  canOrder: boolean;
};

const ALL = "todos";

export function CatalogView({ products, categories, canOrder }: Props) {
  const [active, setActive] = useState<string>(ALL);
  const lines = useCart();
  const summary = resolveCart(lines, products);

  // Só mostra categorias que têm produtos disponíveis.
  const usedCategories = categories.filter((c) => products.some((p) => p.category_id === c.id));
  const hasUncategorized = products.some((p) => !p.category_id || !usedCategories.some((c) => c.id === p.category_id));
  const showFilters = usedCategories.length > 0;

  const visible =
    active === ALL
      ? products
      : active === "outros"
        ? products.filter((p) => !p.category_id || !usedCategories.some((c) => c.id === p.category_id))
        : products.filter((p) => p.category_id === active);

  const groups: { id: string; name: string; items: CatalogProduct[] }[] =
    active === ALL && showFilters
      ? [
          ...usedCategories.map((c) => ({
            id: c.id,
            name: c.name,
            items: products.filter((p) => p.category_id === c.id),
          })),
          ...(hasUncategorized
            ? [
                {
                  id: "outros",
                  name: "Outros",
                  items: products.filter((p) => !p.category_id || !usedCategories.some((c) => c.id === p.category_id)),
                },
              ]
            : []),
        ]
      : [{ id: active, name: "", items: visible }];

  return (
    <>
      {showFilters ? (
        <div
          className="sticky top-16 z-20 -mx-4 mb-6 overflow-x-auto border-b border-linha/70 bg-acucar/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:border sm:px-3"
          role="toolbar"
          aria-label="Filtrar por categoria"
        >
          <div className="flex w-max gap-2">
            {[{ id: ALL, name: "Tudo" }, ...usedCategories, ...(hasUncategorized ? [{ id: "outros", name: "Outros" }] : [])].map(
              (c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActive(c.id)}
                  aria-pressed={active === c.id}
                  className={`h-11 rounded-full px-4 font-bold transition-colors ${
                    active === c.id ? "bg-ameixa text-white" : "bg-glace text-tinta hover:bg-veu"
                  }`}
                >
                  {c.name}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-12">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={group.name ? `cat-${group.id}` : undefined}>
            {group.name ? (
              <h2 id={`cat-${group.id}`} className="font-display mb-5 text-2xl text-calda sm:text-3xl">
                {group.name}
              </h2>
            ) : null}
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((product, index) => (
                <li key={product.id}>
                  <ProductCard product={product} canOrder={canOrder} priority={index < 2 && group === groups[0]} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canOrder && summary.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-glace/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgb(46_36_41/0.08)] backdrop-blur">
          <div className="container-page flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-bold">
                {summary.count} {summary.count === 1 ? "item" : "itens"} no pedido
              </p>
              <p className="truncate text-sm text-suave">
                {summary.itemsTotal > 0 ? formatMoney(summary.itemsTotal) : null}
                {summary.hasUnpriced ? (summary.itemsTotal > 0 ? " + itens a combinar" : "Valores a combinar") : null}
              </p>
            </div>
            <Link href="/pedido/finalizar" className="btn btn-primary shrink-0">
              <BagIcon className="h-5 w-5" />
              Revisar pedido
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
