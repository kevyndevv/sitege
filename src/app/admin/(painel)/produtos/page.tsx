import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { publicImageUrl } from "@/lib/supabase/config";
import type { AdminProduct, Category } from "@/lib/types";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { EmptyState } from "@/components/admin/EmptyState";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { ImageIcon, PlusIcon } from "@/components/icons";

export const metadata = { title: "Produtos" };

type Search = { ver?: string; salvo?: string };

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const showArchived = sp.ver === "arquivados";

  const [productsRes, categoriesRes, archivedCount] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price_cents, unit_label, image_path, category_id, active, archived, sort_order, created_at, updated_at")
      .eq("archived", showArchived)
      .order("sort_order")
      .order("name")
      .returns<AdminProduct[]>(),
    supabase.from("categories").select("id, name, sort_order").order("sort_order").order("name").returns<Category[]>(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("archived", true),
  ]);

  const products = productsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl sm:text-4xl">Produtos</h1>
        <Link href="/admin/produtos/novo" className="btn btn-primary">
          <PlusIcon className="h-5 w-5" />
          Novo produto
        </Link>
      </div>

      {sp.salvo ? (
        <p role="status" className="rounded-2xl bg-ok-fundo px-5 py-3 font-bold text-ok">
          {sp.salvo === "criado" ? "Produto cadastrado!" : "Alterações salvas!"}
        </p>
      ) : null}

      <div className="inline-flex rounded-full border border-linha bg-glace p-1" role="group" aria-label="Mostrar">
        <Link
          href="/admin/produtos"
          aria-current={!showArchived ? "true" : undefined}
          className={`rounded-full px-4 py-2 font-bold ${!showArchived ? "bg-ameixa text-white" : "text-tinta hover:bg-veu"}`}
        >
          No cardápio
        </Link>
        <Link
          href="/admin/produtos?ver=arquivados"
          aria-current={showArchived ? "true" : undefined}
          className={`rounded-full px-4 py-2 font-bold ${showArchived ? "bg-ameixa text-white" : "text-tinta hover:bg-veu"}`}
        >
          Arquivados ({archivedCount.count ?? 0})
        </Link>
      </div>

      {productsRes.error ? (
        <p role="alert" className="rounded-2xl bg-erro-fundo px-5 py-4 font-bold text-erro">
          Não foi possível carregar os produtos. Atualize a página.
        </p>
      ) : products.length === 0 ? (
        <EmptyState title={showArchived ? "Nenhum produto arquivado." : "Nenhum produto cadastrado ainda."}>
          {showArchived ? null : (
            <Link href="/admin/produtos/novo" className="btn btn-primary mt-2">
              Cadastrar o primeiro produto
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {products.map((p, i) => {
            const image = publicImageUrl(p.image_path);
            return (
              <li key={p.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-veu">
                  {image ? (
                    <Image src={image} alt="" fill sizes="6rem" className="object-cover" />
                  ) : (
                    <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-ameixa-clara" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {p.name}
                    {!p.active && !p.archived ? (
                      <span className="ml-2 rounded-full bg-alerta-fundo px-2 py-0.5 text-sm text-alerta">Em falta</span>
                    ) : null}
                  </p>
                  <p className="text-suave">
                    {p.price_cents === null ? "Preço a combinar" : formatMoney(p.price_cents)}
                    {p.unit_label ? ` / ${p.unit_label}` : ""}
                    {p.category_id && categoryName.get(p.category_id) ? `, ${categoryName.get(p.category_id)}` : ""}
                  </p>
                </div>
                <ProductRowActions
                  id={p.id}
                  name={p.name}
                  active={p.active}
                  archived={p.archived}
                  isFirst={i === 0}
                  isLast={i === products.length - 1}
                />
              </li>
            );
          })}
        </ul>
      )}

      {!showArchived ? (
        <section aria-labelledby="categorias" className="card max-w-2xl p-5 sm:p-6">
          <h2 id="categorias" className="font-display mb-3 text-2xl">
            Categorias
          </h2>
          <CategoryManager categories={categories} />
        </section>
      ) : null}
    </div>
  );
}
