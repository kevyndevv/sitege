"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveProduct } from "@/actions/admin-products";
import { centsToInput } from "@/lib/format";
import type { AdminProduct, Category } from "@/lib/types";
import { Spinner } from "@/components/ui/Spinner";
import { ImagePicker } from "./ImagePicker";

type Props = {
  product: AdminProduct | null;
  categories: Category[];
  imageUrl: string | null;
};

export function ProductForm({ product, categories, imageUrl }: Props) {
  const [state, formAction, pending] = useActionState(saveProduct, null);
  const [image, setImage] = useState<{ file: File | null; removed: boolean }>({ file: null, removed: false });
  const errors = state?.fieldErrors ?? {};

  return (
    <form
      action={(formData) => {
        if (image.file) formData.set("image", image.file);
        if (image.removed) formData.set("remove_image", "1");
        formAction(formData);
      }}
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
      noValidate
    >
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <div className="card space-y-5 p-5 sm:p-6">
        <div>
          <label htmlFor="name" className="field-label">
            Nome do produto
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={80}
            defaultValue={product?.name ?? ""}
            className="input"
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name ? <span className="field-error">{errors.name}</span> : null}
        </div>

        <div>
          <label htmlFor="description" className="field-label">
            Descrição <span className="font-normal text-suave">(opcional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            maxLength={600}
            defaultValue={product?.description ?? ""}
            className="input"
            placeholder="Sabores, tamanho, ingredientes principais…"
          />
          {errors.description ? <span className="field-error">{errors.description}</span> : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="field-label">
              Preço (R$)
            </label>
            <input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder="Ex.: 12,50"
              defaultValue={centsToInput(product?.price_cents ?? null)}
              className="input"
              aria-invalid={errors.price ? true : undefined}
            />
            <span className="field-hint">Deixe em branco para mostrar “preço a combinar”.</span>
            {errors.price ? <span className="field-error">{errors.price}</span> : null}
          </div>
          <div>
            <label htmlFor="unit_label" className="field-label">
              Vendido por <span className="font-normal text-suave">(opcional)</span>
            </label>
            <input
              id="unit_label"
              name="unit_label"
              maxLength={30}
              placeholder="unidade, cento, kg, fatia…"
              defaultValue={product?.unit_label ?? ""}
              className="input"
            />
            {errors.unit_label ? <span className="field-error">{errors.unit_label}</span> : null}
          </div>
        </div>

        <div>
          <label htmlFor="category_id" className="field-label">
            Categoria
          </label>
          <select id="category_id" name="category_id" defaultValue={product?.category_id ?? ""} className="input">
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {categories.length === 0 ? (
            <span className="field-hint">Você pode criar categorias (ex.: Doces, Salgados) na lista de produtos.</span>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-veu/70 p-4">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product ? product.active : true}
            className="mt-1 h-5 w-5 accent-[#75616b]"
          />
          <span>
            <span className="block font-bold">Disponível para pedidos</span>
            <span className="text-suave">Desmarque quando o produto estiver em falta. Ele some do cardápio até você marcar de novo.</span>
          </span>
        </label>
      </div>

      <div className="space-y-5">
        <div className="card p-5 sm:p-6">
          <ImagePicker
            label="Foto"
            currentUrl={imageUrl}
            error={errors.image}
            onChange={(file, removed) => setImage({ file, removed })}
          />
        </div>

        {state && !state.ok ? (
          <p role="alert" className="rounded-2xl bg-erro-fundo px-4 py-3 font-bold text-erro">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
            {pending ? (
              <>
                <Spinner /> Salvando…
              </>
            ) : product ? (
              "Salvar alterações"
            ) : (
              "Cadastrar produto"
            )}
          </button>
          <Link href="/admin/produtos" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
