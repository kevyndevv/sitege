"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, type AdminSession } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { revalidatePublicPages } from "@/lib/revalidate";
import { IMAGES_BUCKET } from "@/lib/supabase/config";
import { isUuid } from "@/lib/validation";
import { readImageUpload } from "@/lib/image-upload";

export type ProductFormResult = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<"name" | "description" | "price" | "unit_label" | "category_id" | "image", string>>;
} | null;

export type SimpleResult = { ok: true; message?: string } | { ok: false; message: string };

const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";

async function session(): Promise<AdminSession | null> {
  try {
    return await assertAdmin();
  } catch {
    return null;
  }
}

function text(formData: FormData, key: string, max: number): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

function refresh() {
  revalidatePath("/admin/produtos", "layout");
  revalidatePublicPages();
}

/**
 * Cria ou edita um produto. Apenas os campos abaixo são aceitos (o restante do
 * formulário é ignorado), e a RLS garante que só a dona consegue gravar.
 */
export async function saveProduct(_prev: ProductFormResult, formData: FormData): Promise<ProductFormResult> {
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };

  const idRaw = formData.get("id");
  const id = typeof idRaw === "string" && idRaw ? idRaw : null;
  if (id !== null && !isUuid(id)) return { ok: false, message: "Produto inválido." };

  const name = text(formData, "name", 80).replace(/\s+/g, " ");
  const description = text(formData, "description", 600);
  const priceText = text(formData, "price", 20);
  const unitLabel = text(formData, "unit_label", 30);
  const categoryId = text(formData, "category_id", 36);
  const active = formData.get("active") === "on";
  const removeImage = formData.get("remove_image") === "1";

  const fieldErrors: NonNullable<ProductFormResult>["fieldErrors"] = {};
  if (name.length < 1) fieldErrors.name = "Informe o nome do produto.";
  else if (name.length > 80) fieldErrors.name = "Use no máximo 80 caracteres.";
  if (description.length > 600) fieldErrors.description = "Use no máximo 600 caracteres.";
  let priceCents: number | null = null;
  if (priceText) {
    priceCents = parseMoneyToCents(priceText);
    if (priceCents === null || priceCents > 10_000_000) fieldErrors.price = "Preço inválido. Exemplo: 12,50";
  }
  if (unitLabel.length > 30) fieldErrors.unit_label = "Use no máximo 30 caracteres.";
  if (categoryId && !isUuid(categoryId)) fieldErrors.category_id = "Categoria inválida.";

  const upload = await readImageUpload(formData.get("image"));
  if (upload.error) fieldErrors.image = upload.error;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Confira os campos destacados.", fieldErrors };
  }

  let previousImage: string | null = null;
  if (id) {
    const { data: current, error } = await s.supabase.from("products").select("image_path").eq("id", id).maybeSingle();
    if (error || !current) return { ok: false, message: "Produto não encontrado." };
    previousImage = current.image_path;
  }

  let imagePath: string | null | undefined = undefined; // undefined = não mexe na foto
  if (upload.file) {
    const path = `products/${randomUUID()}.${upload.file.ext}`;
    const { error } = await s.supabase.storage.from(IMAGES_BUCKET).upload(path, upload.file.bytes, {
      contentType: upload.file.mime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      console.error("[saveProduct] falha no envio da foto:", error.message);
      return { ok: false, message: "Não foi possível enviar a foto. Tente novamente.", fieldErrors: { image: "Falha no envio." } };
    }
    imagePath = path;
  } else if (removeImage) {
    imagePath = null;
  }

  const values = {
    name,
    description: description || null,
    price_cents: priceCents,
    unit_label: unitLabel || null,
    category_id: categoryId || null,
    active,
    ...(imagePath !== undefined ? { image_path: imagePath } : {}),
  };

  if (id) {
    const { error } = await s.supabase.from("products").update(values).eq("id", id);
    if (error) {
      console.error("[saveProduct] falha ao atualizar:", error.code);
      if (typeof imagePath === "string") await s.supabase.storage.from(IMAGES_BUCKET).remove([imagePath]);
      return { ok: false, message: "Não foi possível salvar o produto. Tente novamente." };
    }
    if (imagePath !== undefined && previousImage && previousImage !== imagePath) {
      await s.supabase.storage.from(IMAGES_BUCKET).remove([previousImage]);
    }
  } else {
    const { data: last } = await s.supabase
      .from("products")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await s.supabase.from("products").insert({ ...values, sort_order: (last?.sort_order ?? 0) + 1 });
    if (error) {
      console.error("[saveProduct] falha ao criar:", error.code);
      if (typeof imagePath === "string") await s.supabase.storage.from(IMAGES_BUCKET).remove([imagePath]);
      return { ok: false, message: "Não foi possível criar o produto. Tente novamente." };
    }
  }

  refresh();
  redirect(`/admin/produtos?salvo=${id ? "editado" : "criado"}`);
}

export async function setProductActive(id: unknown, active: unknown): Promise<SimpleResult> {
  if (!isUuid(id) || typeof active !== "boolean") return { ok: false, message: "Dados inválidos." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };
  const { error } = await s.supabase.from("products").update({ active }).eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar. Tente novamente." };
  refresh();
  return { ok: true };
}

export async function setProductArchived(id: unknown, archived: unknown): Promise<SimpleResult> {
  if (!isUuid(id) || typeof archived !== "boolean") return { ok: false, message: "Dados inválidos." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };
  const { error } = await s.supabase
    .from("products")
    .update(archived ? { archived: true, active: false } : { archived: false })
    .eq("id", id);
  if (error) return { ok: false, message: "Não foi possível atualizar. Tente novamente." };
  refresh();
  return { ok: true, message: archived ? "Produto arquivado." : "Produto restaurado (ainda indisponível)." };
}

/**
 * Exclui de vez um produto que nunca foi pedido OU que só aparece em pedidos
 * cancelados. Os pedidos guardam nome e preço do momento da compra, então o
 * histórico continua igual. Produto em pedido válido deve ser arquivado
 * (o banco também impede a exclusão nesse caso).
 */
export async function deleteProduct(id: unknown): Promise<SimpleResult> {
  if (!isUuid(id)) return { ok: false, message: "Produto inválido." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };

  const { count, error: countError } = await s.supabase
    .from("order_items")
    .select("id, orders!inner(status)", { count: "exact", head: true })
    .eq("product_id", id)
    .neq("orders.status", "cancelled");
  if (countError) return { ok: false, message: "Não foi possível verificar os pedidos. Tente novamente." };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: "Este produto está em pedidos que não foram cancelados. Mantenha-o arquivado para preservar o histórico.",
    };
  }
  const { data: product } = await s.supabase.from("products").select("image_path").eq("id", id).maybeSingle();
  const { error } = await s.supabase.from("products").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      message: error.message.includes("PRODUCT_IN_ORDERS")
        ? "Este produto está em pedidos que não foram cancelados. Mantenha-o arquivado."
        : "Não foi possível excluir. Tente novamente.",
    };
  }
  if (product?.image_path) await s.supabase.storage.from(IMAGES_BUCKET).remove([product.image_path]);
  refresh();
  return { ok: true, message: "Produto excluído." };
}

/** Sobe ou desce um item na ordem de exibição (renumera a lista inteira, que é pequena). */
async function move(table: "products" | "categories", id: unknown, direction: unknown): Promise<SimpleResult> {
  if (!isUuid(id) || (direction !== "up" && direction !== "down")) return { ok: false, message: "Dados inválidos." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };

  let query = s.supabase.from(table).select("id, sort_order").order("sort_order").order("name");
  if (table === "products") query = query.eq("archived", false);
  const { data, error } = await query;
  if (error || !data) return { ok: false, message: "Não foi possível reordenar." };

  const ids = data.map((r) => r.id as string);
  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return { ok: true };
  [ids[index], ids[target]] = [ids[target], ids[index]];

  const updates = ids
    .map((rowId, i) => ({ id: rowId, sort_order: i + 1 }))
    .filter((row) => data.find((d) => d.id === row.id)?.sort_order !== row.sort_order);
  for (const row of updates) {
    const { error: e } = await s.supabase.from(table).update({ sort_order: row.sort_order }).eq("id", row.id);
    if (e) return { ok: false, message: "Não foi possível reordenar." };
  }
  refresh();
  return { ok: true };
}

export async function moveProduct(id: unknown, direction: unknown) {
  return move("products", id, direction);
}

export async function moveCategory(id: unknown, direction: unknown) {
  return move("categories", id, direction);
}

function categoryName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export async function createCategory(name: unknown): Promise<SimpleResult> {
  const clean = categoryName(name);
  if (!clean) return { ok: false, message: "Informe um nome de até 60 caracteres." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };
  const { data: last } = await s.supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await s.supabase.from("categories").insert({ name: clean, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) {
    return { ok: false, message: error.code === "23505" ? "Já existe uma categoria com esse nome." : "Não foi possível criar." };
  }
  refresh();
  return { ok: true, message: "Categoria criada." };
}

export async function renameCategory(id: unknown, name: unknown): Promise<SimpleResult> {
  const clean = categoryName(name);
  if (!isUuid(id) || !clean) return { ok: false, message: "Informe um nome de até 60 caracteres." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };
  const { error } = await s.supabase.from("categories").update({ name: clean }).eq("id", id);
  if (error) {
    return { ok: false, message: error.code === "23505" ? "Já existe uma categoria com esse nome." : "Não foi possível renomear." };
  }
  refresh();
  return { ok: true, message: "Categoria renomeada." };
}

export async function deleteCategory(id: unknown): Promise<SimpleResult> {
  if (!isUuid(id)) return { ok: false, message: "Categoria inválida." };
  const s = await session();
  if (!s) return { ok: false, message: SESSION_EXPIRED };
  // Os produtos da categoria continuam existindo, apenas ficam "sem categoria".
  const { error } = await s.supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir a categoria." };
  refresh();
  return { ok: true, message: "Categoria excluída. Os produtos dela ficaram sem categoria." };
}
