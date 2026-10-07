/** Chave usada para lembrar a escolha de modo claro/escuro neste aparelho. */
export const THEME_STORAGE_KEY = "encomendas:tema";

/**
 * Script executado antes da página aparecer, para aplicar o tema certo sem
 * "piscar" (modo claro aparecendo por um instante antes do escuro).
 * Sem escolha salva, segue a preferência do sistema do aparelho.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
