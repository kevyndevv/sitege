"use client";

import { MinusIcon, PlusIcon } from "@/components/icons";

type Props = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  size?: "md" | "lg";
};

/** Botões grandes de − e + com campo numérico (fácil de tocar no celular). */
export function QuantityStepper({ value, onChange, label, min = 0, max = 999, size = "md" }: Props) {
  const btn = size === "lg" ? "h-12 w-12" : "h-11 w-11";
  return (
    <div className="inline-flex items-center rounded-full border border-linha bg-glace" role="group" aria-label={label}>
      <button
        type="button"
        className={`${btn} inline-flex items-center justify-center rounded-full text-tinta hover:bg-veu disabled:opacity-40`}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Diminuir quantidade de ${label}`}
      >
        <MinusIcon />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(n) ? min : Math.max(min, Math.min(max, n)));
        }}
        className="w-12 appearance-none bg-transparent text-center text-lg font-bold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={`Quantidade de ${label}`}
      />
      <button
        type="button"
        className={`${btn} inline-flex items-center justify-center rounded-full text-tinta hover:bg-veu disabled:opacity-40`}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
