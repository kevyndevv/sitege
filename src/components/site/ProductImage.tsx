import Image from "next/image";
import { publicImageUrl } from "@/lib/supabase/config";

type Props = {
  path: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * Foto de produto com proporção fixa (evita "pulos" no carregamento).
 * Sem foto cadastrada, mostra um espaço reservado discreto — nunca uma foto
 * genérica que possa enganar o cliente sobre o produto.
 */
export function ProductImage({ path, alt, sizes, priority, className }: Props) {
  const src = publicImageUrl(path);
  return (
    <div className={`relative aspect-[4/3] overflow-hidden bg-veu ${className ?? ""}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <FormaPlaceholder />
        </div>
      )}
    </div>
  );
}

/** Desenho simples de uma forminha de doce, usado quando ainda não há foto. */
export function FormaPlaceholder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className ?? "h-16 w-auto text-ameixa-clara"} fill="none">
      <circle cx="60" cy="36" r="20" fill="currentColor" opacity="0.35" />
      <path
        d="M30 46h60l-7 28a6 6 0 0 1-6 4.5H43A6 6 0 0 1 37 74L30 46Z"
        fill="currentColor"
        opacity="0.55"
      />
      <path
        d="M38 46l3 32M46 46l2 32M54 46l1 32M62 46l-.5 32M70 46l-1.5 32M78 46l-3 32"
        stroke="#fff"
        strokeWidth="1.4"
        opacity="0.7"
      />
    </svg>
  );
}
