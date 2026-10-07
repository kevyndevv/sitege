import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { ProductForm } from "@/components/admin/ProductForm";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  const { supabase } = await requireAdmin();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order")
    .returns<Category[]>();
  return (
    <div className="space-y-6">
      <Link href="/admin/produtos" className="btn btn-ghost -ml-3">
        <ArrowLeftIcon className="h-5 w-5" />
        Produtos
      </Link>
      <h1 className="font-display text-3xl sm:text-4xl">Novo produto</h1>
      <ProductForm product={null} categories={categories ?? []} imageUrl={null} />
    </div>
  );
}
