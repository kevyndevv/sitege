"use client";

import { useEffect, useRef } from "react";

/**
 * Prende o menu (e o aviso de encomendas pausadas, quando houver) no topo da
 * tela ao rolar a página. A altura real fica em --topo, para que as barras
 * fixas mais abaixo (filtro de categorias, resumo do pedido) não fiquem
 * escondidas por baixo.
 */
export function StickyTop({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--topo", `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--topo");
    };
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-30">
      {children}
    </div>
  );
}
