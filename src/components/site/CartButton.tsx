"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart-store";
import { BagIcon } from "@/components/icons";

export function CartButton() {
  const count = cartCount(useCart());
  return (
    <Link
      href="/pedido/finalizar"
      className="relative inline-flex h-11 items-center gap-2 rounded-full px-3 text-tinta hover:bg-veu"
      aria-label={count > 0 ? `Ver meu pedido (${count} ${count === 1 ? "item" : "itens"})` : "Ver meu pedido"}
    >
      <BagIcon className="h-6 w-6" />
      <span className="hidden font-bold sm:inline">Meu pedido</span>
      {count > 0 ? (
        <span
          key={count}
          className="animate-pop absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-ameixa px-1.5 text-sm font-bold text-white sm:static sm:ml-0.5"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
