"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  updateCategory,
  type SimpleResult,
} from "@/actions/admin-products";
import { daysLabel } from "@/lib/lead-time";
import type { Category } from "@/lib/types";
import { ClockIcon, DownIcon, UpIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [newName, setNewName] = useState("");
  const [newLead, setNewLead] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; lead: string } | null>(null);
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
        Categorias organizam o cardápio (ex.: Doces, Salgados, Bolos). São opcionais. Cada uma pode ter sua própria{" "}
        <strong className="text-tinta">antecedência mínima</strong>: se o pedido tiver itens de categorias diferentes, vale a
        maior (incluindo a antecedência geral das Configurações).
      </p>
      {categories.length > 0 ? (
        <ul className="divide-y divide-linha rounded-2xl border border-linha">
          {categories.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing?.id === c.id ? (
                <form
                  className="flex flex-1 flex-wrap items-end gap-2 py-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => updateCategory(c.id, editing.name, editing.lead), () => setEditing(null));
                  }}
                >
                  <div className="min-w-40 flex-1">
                    <label htmlFor={`cat-${c.id}`} className="text-sm font-bold">
                      Nome
                    </label>
                    <input
                      id={`cat-${c.id}`}
                      className="input min-h-10 py-1.5"
                      maxLength={60}
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="w-36">
                    <label htmlFor={`cat-lead-${c.id}`} className="text-sm font-bold">
                      Antecedência (dias)
                    </label>
                    <input
                      id={`cat-lead-${c.id}`}
                      className="input min-h-10 py-1.5"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="Não exige"
                      value={editing.lead}
                      onChange={(e) => setEditing({ ...editing, lead: e.target.value.replace(/\D/g, "") })}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm min-h-10" disabled={isPending}>
                    Salvar
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm min-h-10" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">{c.name}</span>
                    {c.min_lead_days !== null ? (
                      <span className="inline-flex items-center gap-1 text-sm text-suave">
                        <ClockIcon className="h-4 w-4" />
                        {c.min_lead_days === 0 ? "Pode pedir para hoje" : `${daysLabel(c.min_lead_days)} de antecedência`}
                      </span>
                    ) : null}
                  </span>
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setEditing({ id: c.id, name: c.name, lead: c.min_lead_days === null ? "" : String(c.min_lead_days) })
                    }
                  >
                    Editar
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
          run(() => createCategory(newName, newLead), () => {
            setNewName("");
            setNewLead("");
          });
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
        <label htmlFor="nova-categoria-prazo" className="sr-only">
          Antecedência mínima da nova categoria, em dias (opcional)
        </label>
        <input
          id="nova-categoria-prazo"
          className="input min-h-11 w-40"
          inputMode="numeric"
          maxLength={2}
          placeholder="Dias (opcional)"
          value={newLead}
          onChange={(e) => setNewLead(e.target.value.replace(/\D/g, ""))}
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
