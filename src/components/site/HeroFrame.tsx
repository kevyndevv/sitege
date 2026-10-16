import type { HeroFrameId } from "@/lib/hero-frames";

/**
 * Moldura da foto da página inicial. As medidas são em "em": a mesma moldura
 * serve na página (fonte 16px) e na miniatura do painel (fonte menor).
 * `children` deve preencher a área da foto (ex.: <Image fill />).
 */
export function HeroFrame({
  frame,
  children,
  className = "",
}: {
  frame: HeroFrameId;
  children: React.ReactNode;
  className?: string;
}) {
  const inner = <span aria-hidden="true" className="moldura-sombra-interna" />;

  switch (frame) {
    case "arco":
      return (
        <div className={`moldura moldura-arco ${className}`}>
          <div className="moldura-foto aspect-[4/5]">
            {children}
            {inner}
          </div>
        </div>
      );

    case "polaroid":
      return (
        <div className={`moldura moldura-polaroid ${className}`}>
          <span aria-hidden="true" className="fita" />
          <div className="moldura-foto aspect-square">
            {children}
            {inner}
          </div>
          <span aria-hidden="true" className="legenda">
            <svg viewBox="0 0 24 24" className="h-[1.4em] w-[1.4em]" fill="currentColor">
              <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
            </svg>
          </span>
        </div>
      );

    case "renda":
      return (
        <div className={`moldura moldura-renda ${className}`}>
          <svg aria-hidden="true" viewBox="0 0 100 100" className="renda">
            <path d={DOILY_PATH} fill="currentColor" fillRule="evenodd" />
            <path d={INNER_SCALLOP} fill="none" stroke="rgb(168 148 158 / 0.7)" strokeWidth="0.5" />
            <circle cx="50" cy="50" r="34.9" fill="none" stroke="#a8949e" strokeWidth="0.7" />
          </svg>
          <div className="moldura-foto">
            {children}
            {inner}
          </div>
        </div>
      );

    case "dourada":
      return (
        <div className={`moldura moldura-dourada ${className}`}>
          <div className="moldura-foto aspect-[4/5]">
            {children}
            {inner}
          </div>
        </div>
      );

    default:
      return (
        <div className={`moldura moldura-madeira ${className}`}>
          <span aria-hidden="true" className="ripa ripa-topo" />
          <span aria-hidden="true" className="ripa ripa-base" />
          <span aria-hidden="true" className="ripa ripa-esq" />
          <span aria-hidden="true" className="ripa ripa-dir" />
          <div className="moldura-foto aspect-[4/5]">
            {children}
            {inner}
          </div>
        </div>
      );
  }
}

/* ---- Toalhinha de renda: borda em ondinhas com furinhos (SVG 100×100) ---- */

const f = (n: number) => n.toFixed(2);

/** Círculo em ondinhas: n meias-luas apoiadas num círculo de raio r. */
function scallopPath(r: number, n: number): string {
  const bump = r * Math.sin(Math.PI / n);
  let d = "";
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    d += i === 0 ? `M${f(x)} ${f(y)}` : `A${f(bump)} ${f(bump)} 0 0 1 ${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
}

/** Furinhos (vazados pela regra evenodd) em volta do círculo de raio r. */
function holes(r: number, n: number, size: number, offset = 0): string {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = ((i + offset) / n) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + r * Math.cos(a);
    const y = 50 + r * Math.sin(a);
    d += `M${f(x - size)} ${f(y)}a${size} ${size} 0 1 0 ${size * 2} 0a${size} ${size} 0 1 0 ${-size * 2} 0`;
  }
  return d;
}

const DOILY_PATH = scallopPath(46, 36) + holes(47.6, 36, 0.75, 0.5) + holes(43.2, 36, 1.1);
const INNER_SCALLOP = scallopPath(36, 28);
