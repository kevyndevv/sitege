"use client";

import { useState } from "react";
import { HERO_FRAMES, heroFrameOrDefault } from "@/lib/hero-frames";
import { CheckIcon } from "@/components/icons";
import { HeroFrame } from "@/components/site/HeroFrame";
import { FormaPlaceholder } from "@/components/site/ProductImage";

/** Escolha da moldura da foto da página inicial, com miniaturas de cada uma. */
export function FramePicker({
  defaultValue,
  photoUrl,
  error,
}: {
  defaultValue: string | null;
  photoUrl: string | null;
  error?: string;
}) {
  const [value, setValue] = useState(heroFrameOrDefault(defaultValue));

  return (
    <fieldset>
      <legend className="field-label">Moldura da foto da página inicial</legend>
      <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {HERO_FRAMES.map((f) => {
          const checked = value === f.id;
          return (
            <label
              key={f.id}
              className={`flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ameixa has-[:focus-visible]:ring-offset-2 ${
                checked ? "border-ameixa" : "border-linha hover:border-ameixa-clara"
              }`}
            >
              <input
                type="radio"
                name="hero_frame"
                value={f.id}
                checked={checked}
                onChange={() => setValue(f.id)}
                className="sr-only"
              />
              <span className="flex h-44 items-center justify-center bg-ameixa p-4" aria-hidden="true">
                <HeroFrame frame={f.id} className="w-24 text-[6px]">
                  {photoUrl ? (
                    <span
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url("${photoUrl}")` }}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <FormaPlaceholder className="h-8 w-auto text-white/60" />
                    </span>
                  )}
                </HeroFrame>
              </span>
              <span className={`flex flex-1 items-start gap-2 p-3 ${checked ? "bg-veu" : "bg-glace"}`}>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    checked ? "border-ameixa bg-ameixa text-white" : "border-linha"
                  }`}
                >
                  {checked ? <CheckIcon className="h-3 w-3" /> : null}
                </span>
                <span>
                  <span className="block font-bold leading-tight">{f.label}</span>
                  <span className="text-sm text-suave">{f.hint}</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <span className="field-hint">A moldura muda na página inicial depois de salvar.</span>
      {error ? <span className="field-error">{error}</span> : null}
    </fieldset>
  );
}
