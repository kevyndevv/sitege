"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteProduct,
  moveProduct,
  setProductActive,
  setProductArchived,
  type SimpleResult,
} from "@/actions/admin-products";
import { DownIcon, UpIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Props = {
  id: string;
  name: string;
  active: boolean;
  archived: boolean;
  isFirst: boolean;
  isLast: boolean;
};

export function ProductRowActions({ id, name, active, archived, isFirst, isLast }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SimpleResult | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  function run(action: () => Promise<SimpleResult>) {
    startTransition(async () => {
      const r = await action();
      setResult(r.ok && !r.message ? null : r);
      setConfirm(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!archived ? (
          <>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-veu px-3 font-bold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#75616b]"
                checked={active}
                disabled={isPending}
                onChange={(e) => {
                  const checked = e.target.checked;
                  run(() => setProductActive(id, checked));
                }}
              />
              Disponível
            </label>
            <Link href={`/admin/produtos/${id}`} className="btn btn-outline btn-sm">
              Editar
            </Link>
            <div className="inline-flex">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-veu disabled:opacity-30"
                disabled={isPending || isFirst}
                onClick={() => run(() => moveProduct(id, "up"))}
                aria-label={`Subir ${name} na ordem do cardápio`}
              >
                <UpIcon />
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-veu disabled:opacity-30"
                disabled={isPending || isLast}
                onClick={() => run(() => moveProduct(id, "down"))}
                aria-label={`Descer ${name} na ordem do cardápio`}
              >
                <DownIcon />
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" disabled={isPending} onClick={() => setConfirm("archive")}>
              Arquivar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={isPending}
              onClick={() => run(() => setProductArchived(id, false))}
            >
              Restaurar
            </button>
            <button type="button" className="btn btn-ghost btn-sm text-erro" disabled={isPending} onClick={() => setConfirm("delete")}>
              Excluir de vez
            </button>
          </>
        )}
      </div>
      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-ok" : "text-erro"}`}>
          {result.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "delete" ? `Excluir “${name}” de vez?` : `Arquivar “${name}”?`}
        description={
          confirm === "delete" ? (
            <p>Só é possível excluir produtos que nunca foram pedidos. Esta ação não pode ser desfeita.</p>
          ) : (
            <p>
              O produto sai do cardápio e da lista principal, mas continua nos pedidos antigos. Você pode restaurá-lo
              depois.
            </p>
          )
        }
        confirmLabel={confirm === "delete" ? "Sim, excluir" : "Sim, arquivar"}
        danger={confirm === "delete"}
        busy={isPending}
        onConfirm={() => run(() => (confirm === "delete" ? deleteProduct(id) : setProductArchived(id, true)))}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
