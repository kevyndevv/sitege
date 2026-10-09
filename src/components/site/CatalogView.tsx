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
        // Barra fixa na cor da marca: depois de adicionar algo, o próximo passo
        // ("Revisar pedido") fica sempre visível e chama atenção.
        <div data-cart-bar className="animate-toast fixed inset-x-0 bottom-0 z-30 bg-ameixa pb-[env(safe-area-inset-bottom)] text-white shadow-[0_-8px_28px_rgb(46_36_41/0.25)]">
          <div className="container-page flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                key={summary.count}
                className="animate-pop flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white px-2 text-lg font-bold text-[#5b4a53]"
                aria-hidden="true"
              >
                {summary.count}
              </span>
              <div className="min-w-0">
                <p className="font-bold">{summary.count === 1 ? "item no pedido" : "itens no pedido"}</p>
                <p className="truncate text-sm text-white/85">
                  {summary.itemsTotal > 0 ? formatMoney(summary.itemsTotal) : null}
                  {summary.hasUnpriced ? (summary.itemsTotal > 0 ? " + itens a combinar" : "Valores a combinar") : null}
                </p>
              </div>
            </div>
            <Link
              href="/pedido/finalizar"
              className="btn btn-light min-h-12 shrink-0 px-5 shadow-md sm:px-7"
              aria-label={`Revisar pedido com ${summary.count} ${summary.count === 1 ? "item" : "itens"}`}
            >
              <BagIcon className="h-5 w-5" />
              Revisar pedido
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
