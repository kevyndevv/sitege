"use client";

import Link from "next/link";
import { addToCart, setQuantity, useCart } from "@/lib/cart-store";
import { PlusIcon } from "@/components/icons";
import { QuantityStepper } from "./QuantityStepper";

/**
 * Antes de adicionar: botão "Adicionar ao pedido".
 * Depois: seletor de quantidade + atalho para ver o pedido.
 */
export function AddToCart({ productId, productName, compact }: { productId: string; productName: string; compact?: boolean }) {
  const lines = useCart();
  const quantity = lines.find((l) => l.productId === productId)?.quantity ?? 0;

  if (quantity === 0) {
    return (
      <button type="button" className="btn btn-outline w-full" onClick={() => addToCart(productId)}>
        <PlusIcon className="h-5 w-5" />
        Adicionar ao pedido
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
      <QuantityStepper value={quantity} onChange={(q) => setQuantity(productId, q)} label={productName} />
      {compact ? (
        <span className="text-sm font-bold text-ok">No pedido</span>
      ) : (
        <Link href="/pedido/finalizar" className="btn btn-ghost btn-sm">
          Ver pedido
        </Link>
      )}
    </div>
  );
}
