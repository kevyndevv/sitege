"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  renameCategory,
  type SimpleResult,
} from "@/actions/admin-products";
import type { Category } from "@/lib/types";
import { DownIcon, UpIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  function run(action: () => Promise<SimpleResult>, after?: () => void) {
    startTransition(async () => {
      const r = await action();
      setResult(r.message ? r : null);
      if (r.ok) after?.();
      setToDelete(null);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-suave">
        Categorias organizam o cardápio (ex.: Doces, Salgados, Bolos). São opcionais.
      </p>
      {categories.length > 0 ? (
        <ul className="divide-y divide-linha rounded-2xl border border-linha">
          {categories.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing?.id === c.id ? (
                <form
                  className="flex flex-1 flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => renameCategory(c.id, editing.name), () => setEditing(null));
                  }}
                >
                  <label htmlFor={`cat-${c.id}`} className="sr-only">
                    Novo nome da categoria
                  </label>
                  <input
                    id={`cat-${c.id}`}
                    className="input min-h-10 flex-1 py-1.5"
                    maxLength={60}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
                    Salvar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-bold">{c.name}</span>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-veu disabled:opacity-30"
                    disabled={isPending || i === 0}
                    onClick={() => run(() => moveCategory(c.id, "up"))}
                    aria-label={`Subir categoria ${c.name}`}
                  >
                    <UpIcon />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-veu disabled:opacity-30"
                    disabled={isPending || i === categories.length - 1}
                    onClick={() => run(() => moveCategory(c.id, "down"))}
                    aria-label={`Descer categoria ${c.name}`}
                  >
                    <DownIcon />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: c.id, name: c.name })}>
                    Renomear
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm text-erro" onClick={() => setToDelete(c)}>
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCategory(newName), () => setNewName(""));
        }}
      >
        <label htmlFor="nova-categoria" className="sr-only">
          Nome da nova categoria
        </label>
        <input
          id="nova-categoria"
          className="input min-h-11 flex-1"
          placeholder="Nova categoria"
          maxLength={60}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn btn-outline btn-sm min-h-11" disabled={isPending || !newName.trim()}>
          Adicionar
        </button>
      </form>

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-ok" : "text-erro"}`}>
          {result.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Excluir a categoria “${toDelete?.name ?? ""}”?`}
        description={<p>Os produtos dela não serão apagados: apenas ficarão sem categoria.</p>}
        confirmLabel="Sim, excluir"
        danger
        busy={isPending}
        onConfirm={() => toDelete && run(() => deleteCategory(toDelete.id))}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
