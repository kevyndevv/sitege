"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ClockIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/icons";
import { TIME_OPTIONS } from "@/lib/validation";

const show = (t: string) => t.replace(":", "h");

/**
 * Escolha do horário, compacta para caber ao lado da data.
 * Sem horário: um botão "Escolher" abre a grade de horários (30 em 30 min).
 * Com horário: "–  14h00  +" ajusta meia hora por toque; tocar no horário
 * reabre a grade, que também tem "Sem preferência".
 */
export function TimePicker({
  value,
  onChange,
  buttonProps,
}: {
  value: string;
  onChange: (value: string) => void;
  buttonProps?: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const labelId = useId();
  const index = TIME_OPTIONS.indexOf(value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(t: string) {
    onChange(t);
    setOpen(false);
  }

  function step(delta: number) {
    const next = TIME_OPTIONS[index + delta];
    if (next) onChange(next);
  }

  const mainButton = {
    type: "button" as const,
    id: "requestedTime",
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    "aria-controls": panelId,
    onClick: () => setOpen((o) => !o),
    ...buttonProps,
  };

  const stepClass =
    "flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-tinta transition-colors hover:bg-glace disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div ref={boxRef} className="relative">
      <span id={labelId} className="field-label">
        Horário <span className="font-normal text-suave">(opcional)</span>
      </span>

      {value ? (
        <div className="flex min-h-12 items-center rounded-xl border-2 border-ameixa bg-veu px-0.5">
          <button type="button" className={stepClass} disabled={index <= 0} onClick={() => step(-1)} aria-label="Meia hora mais cedo">
            <MinusIcon className="h-5 w-5" />
          </button>
          <button
            {...mainButton}
            aria-label={`Horário: ${show(value)}. Toque para ver todos os horários`}
            className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg text-lg font-bold tabular-nums text-calda transition-colors hover:bg-glace"
          >
            <ClockIcon className="hidden h-5 w-5 shrink-0 text-tinta min-[400px]:block" />
            {show(value)}
          </button>
          <button
            type="button"
            className={stepClass}
            disabled={index >= TIME_OPTIONS.length - 1}
            onClick={() => step(1)}
            aria-label="Meia hora mais tarde"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button
          {...mainButton}
          aria-labelledby={labelId}
          className="input flex items-center gap-2 text-left hover:border-ameixa-clara"
        >
          <ClockIcon className="h-5 w-5 shrink-0 text-tinta" />
          <span className="truncate text-suave">Escolher</span>
        </button>
      )}

      {open ? (
        <>
        {/* No celular a grade sobe de baixo da tela (gaveta); no computador abre sob o campo. */}
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
        />
        <div
          id={panelId}
          role="dialog"
          aria-label="Escolha o horário"
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-linha bg-glace px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgb(0_0_0/0.3)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-20 sm:mt-2 sm:w-[22rem] sm:rounded-2xl sm:border sm:p-3 sm:shadow-[0_16px_40px_rgb(0_0_0/0.28)]"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-linha sm:hidden" aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between sm:hidden">
            <p className="font-display text-2xl text-calda">Escolha o horário</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="flex h-10 w-10 items-center justify-center rounded-full text-suave hover:bg-veu"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={value === t}
                onClick={() => choose(t)}
                className={`h-12 rounded-xl text-[0.95rem] font-bold tabular-nums transition-colors sm:h-10 sm:rounded-lg sm:text-[0.9rem] ${
                  value === t ? "bg-ameixa text-white" : "bg-veu text-calda hover:bg-ameixa-clara/40"
                }`}
              >
                {show(t)}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => choose("")} className="btn btn-ghost btn-sm mt-3 w-full sm:mt-2">
            Sem preferência
          </button>
        </div>
        </>
      ) : null}
    </div>
  );
}
