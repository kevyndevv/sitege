/**
 * Molduras da foto da página inicial. A dona escolhe uma no painel
 * (Configurações → Seu negócio); o desenho de cada uma está em HeroFrame.tsx
 * e em globals.css (classes .moldura-*).
 */
export const HERO_FRAMES = [
  { id: "madeira", label: "Quadro de madeira", hint: "Retangular, madeira rústica" },
  { id: "arco", label: "Arco", hint: "Janela em arco com sombra ameixa" },
  { id: "polaroid", label: "Polaroid", hint: "Foto instantânea com fitinha" },
  { id: "renda", label: "Toalhinha de renda", hint: "Redonda, borda de renda de bolo" },
  { id: "dourada", label: "Oval dourada", hint: "Clássica, oval e dourada" },
] as const;

export type HeroFrameId = (typeof HERO_FRAMES)[number]["id"];

export const DEFAULT_HERO_FRAME: HeroFrameId = "madeira";

export function isHeroFrame(value: unknown): value is HeroFrameId {
  return HERO_FRAMES.some((f) => f.id === value);
}

export function heroFrameOrDefault(value: unknown): HeroFrameId {
  return isHeroFrame(value) ? value : DEFAULT_HERO_FRAME;
}
