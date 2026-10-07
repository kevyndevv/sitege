"use client";

/**
 * Passa o telefone da tela de confirmação para a página "Acompanhar pedido"
 * sem colocá-lo no endereço (URL) nem guardá-lo de forma permanente:
 * usa o sessionStorage, que some quando a aba é fechada.
 */
const KEY = "encomendas:acompanhar-telefone";

export function rememberPhoneForTracking(phone: string) {
  try {
    window.sessionStorage.setItem(KEY, phone);
  } catch {
    // armazenamento indisponível: o cliente digita o telefone na página
  }
}

export function takePhoneForTracking(): string | null {
  try {
    const phone = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return phone;
  } catch {
    return null;
  }
}
