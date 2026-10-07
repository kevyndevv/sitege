import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/supabase/config";
import type { AdminProduct, Category } from "@/lib/types";
import { isUuid } from "@/lib/validation";
import { ProductForm } from "@/components/admin/ProductForm";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata = { title: "Editar produto" };

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const [productRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price_cents, unit_label, image_path, category_id, active, archived, sort_order, created_at, updated_at")
      .eq("id", id)
      .maybeSingle<AdminProduct>(),
    supabase.from("categories").select("id, name, sort_order").order("sort_order").returns<Category[]>(),
  ]);
  if (!productRes.data) notFound();
  const product = productRes.data;

  return (
    <div className="space-y-6">
      <Link href="/admin/produtos" className="btn btn-ghost -ml-3">
        <ArrowLeftIcon className="h-5 w-5" />
        Produtos
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl">Editar “{product.name}”</h1>
      {product.archived ? (
        <p className="rounded-2xl bg-alerta-fundo px-5 py-3 text-alerta">
          Este produto está arquivado e não aparece no cardápio. Restaure-o na lista de arquivados.
        </p>
      ) : null}
      <ProductForm product={product} categories={categoriesRes.data ?? []} imageUrl={publicImageUrl(product.image_path)} />
    </div>
  );
}
