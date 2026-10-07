"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação para ações importantes, integrada ao visual (sem alert do navegador). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] bg-glace p-0 text-calda backdrop:bg-black/50"
      aria-labelledby="confirm-title"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="font-display text-2xl text-calda">
          {title}
        </h2>
        {description ? <div className="mt-3 text-suave">{description}</div> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
