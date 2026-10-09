"use client";

import { useState, useTransition } from "react";
import { createZone, deleteZone, updateZone, type ZoneResult } from "@/actions/admin-zones";
import { centsToInput, formatMoney } from "@/lib/format";
import type { AdminDeliveryZone } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Editing = { id: string; name: string; fee: string; active: boolean };

/** Cadastro dos locais de entrega com a taxa de cada um. */
export function ZoneManager({ zones }: { zones: AdminDeliveryZone[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ZoneResult | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [toDelete, setToDelete] = useState<AdminDeliveryZone | null>(null);

  function run(action: () => Promise<ZoneResult>, after?: () => void) {
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if (r.ok) after?.();
      setToDelete(null);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-suave">
        Cada local tem sua taxa. O cliente escolhe o local ao pedir entrega e a taxa entra no total automaticamente.
        Sem nenhum local ativo, a taxa de entrega fica “a combinar”.
      </p>

      {zones.length > 0 ? (
        <ul className="divide-y divide-linha rounded-2xl border border-linha">
          {zones.map((z) =>
            editing?.id === z.id ? (
              <li key={z.id} className="p-3">
                <form
                  className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => updateZone(z.id, editing.name, editing.fee, editing.active), () => setEditing(null));
                  }}
                >
                  <div>
                    <label htmlFor={`zn-${z.id}`} className="field-label text-sm">
                      Local
                    </label>
                    <input
                      id={`zn-${z.id}`}
                      className="input"
                      maxLength={60}
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`zf-${z.id}`} className="field-label text-sm">
                      Taxa (R$)
                    </label>
                    <input
                      id={`zf-${z.id}`}
                      className="input"
                      inputMode="decimal"
                      value={editing.fee}
                      onChange={(e) => setEditing({ ...editing, fee: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
                      Salvar
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 sm:col-span-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#75616b]"
                      checked={editing.active}
                      onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    />
                    Disponível para os clientes escolherem
                  </label>
                </form>
              </li>
            ) : (
              <li key={z.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="flex-1">
                  <span className="font-bold">{z.name}</span>
                  {!z.active ? (
                    <span className="ml-2 rounded-full bg-alerta-fundo px-2 py-0.5 text-sm text-alerta">Desativado</span>
                  ) : null}
                </span>
                <span className="font-bold">{z.fee_cents === 0 ? "grátis" : formatMoney(z.fee_cents)}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing({ id: z.id, name: z.name, fee: centsToInput(z.fee_cents), active: z.active })}
                >
                  Editar
                </button>
                <button type="button" className="btn btn-ghost btn-sm text-erro" onClick={() => setToDelete(z)}>
                  Excluir
                </button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="rounded-2xl bg-veu px-4 py-3">Nenhum local cadastrado: a taxa de entrega fica “a combinar”.</p>
      )}

      <form
        className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createZone(newName, newFee), () => {
            setNewName("");
            setNewFee("");
          });
        }}
      >
        <div>
          <label htmlFor="novo-local" className="field-label text-sm">
            Novo local
          </label>
          <input
            id="novo-local"
            className="input"
            maxLength={60}
            placeholder="Ex.: Ingleses"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="nova-taxa" className="field-label text-sm">
            Taxa (R$)
          </label>
          <input
            id="nova-taxa"
            className="input"
            inputMode="decimal"
            placeholder="10,00"
            value={newFee}
            onChange={(e) => setNewFee(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-outline" disabled={isPending || !newName.trim() || !newFee.trim()}>
          Adicionar
        </button>
      </form>

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`font-bold ${result.ok ? "text-ok" : "text-erro"}`}>
          {result.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Excluir o local “${toDelete?.name ?? ""}”?`}
        description={<p>Pedidos antigos continuam mostrando o local e a taxa cobrada. Clientes não poderão mais escolhê-lo.</p>}
        confirmLabel="Sim, excluir"
        danger
        busy={isPending}
        onConfirm={() => toDelete && run(() => deleteZone(toDelete.id))}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
