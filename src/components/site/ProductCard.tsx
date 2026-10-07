import type { CatalogProduct } from "@/lib/types";
import { AddToCart } from "./AddToCart";
import { PriceTag } from "./PriceTag";
import { ProductImage } from "./ProductImage";

type Props = {
  product: Pick<CatalogProduct, "id" | "name" | "description" | "price_cents" | "unit_label" | "image_path">;
  priority?: boolean;
  canOrder: boolean;
};

export function ProductCard({ product, priority, canOrder }: Props) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <ProductImage
        path={product.image_path}
        alt={product.image_path ? `Foto de ${product.name}` : ""}
        sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 85vw"
        priority={priority}
      />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex-1">
          <h3 className="font-display text-xl leading-snug text-calda">{product.name}</h3>
          {product.description ? (
            <p className="mt-1.5 line-clamp-3 text-[0.98rem] text-suave">{product.description}</p>
          ) : null}
        </div>
        <PriceTag cents={product.price_cents} unit={product.unit_label} />
        {canOrder ? <AddToCart productId={product.id} productName={product.name} /> : null}
      </div>
    </article>
  );
}
