import "server-only";
import { revalidatePath } from "next/cache";

/** Atualiza as páginas públicas (cardápio, início) após mudanças no painel. */
export function revalidatePublicPages() {
  revalidatePath("/", "layout");
}
