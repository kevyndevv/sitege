"use client";

import { useSyncExternalStore } from "react";

/**
 * Carrinho guardado no próprio aparelho do cliente (localStorage).
 * Guarda apenas o ID do produto e a quantidade: nomes e PREÇOS sempre vêm do
 * catálogo atual, e o valor final é recalculado pelo servidor ao enviar.
 */
export type CartLine = { productId: string; quantity: number };

const STORAGE_KEY = "encomendas:carrinho:v1";
const MAX_QUANTITY = 999;
const MAX_LINES = 40;
const EMPTY: CartLine[] = [];

let state: CartLine[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY;
    const lines: CartLine[] = [];
    for (const item of value) {
      if (
        item &&
        typeof item.productId === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= MAX_QUANTITY &&
        !lines.some((l) => l.productId === item.productId)
      ) {
        lines.push({ productId: item.productId, quantity: item.quantity });
      }
    }
    return lines.slice(0, MAX_LINES);
  } catch {
    return EMPTY;
  }
}

function load(): CartLine[] {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function save(next: CartLine[]) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Navegação privada / armazenamento bloqueado: o carrinho funciona só nesta aba.
  }
  emit();
}

function getSnapshot(): CartLine[] {
  if (state === null) state = load();
  return state;
}

function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = parse(event.newValue);
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartLine[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setQuantity(productId: string, quantity: number) {
  const current = getSnapshot();
  const q = Math.max(0, Math.min(MAX_QUANTITY, Math.floor(quantity)));
  if (q === 0) {
    save(current.filter((l) => l.productId !== productId));
    return;
  }
  const exists = current.some((l) => l.productId === productId);
  if (!exists && current.length >= MAX_LINES) return;
  save(
    exists
      ? current.map((l) => (l.productId === productId ? { ...l, quantity: q } : l))
      : [...current, { productId, quantity: q }],
  );
}

export function addToCart(productId: string, amount = 1) {
  const line = getSnapshot().find((l) => l.productId === productId);
  setQuantity(productId, (line?.quantity ?? 0) + amount);
}

export function removeFromCart(productId: string) {
  setQuantity(productId, 0);
}

export function clearCart() {
  save(EMPTY);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
