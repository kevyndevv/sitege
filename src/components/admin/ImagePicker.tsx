"use client";

import { useEffect, useId, useState } from "react";
import { compressImage } from "@/lib/compress-image";
import { ImageIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";

type Props = {
  label: string;
  currentUrl: string | null;
  onChange: (file: File | null, removed: boolean) => void;
  error?: string;
  aspect?: string;
  /** Lado maior da foto após a redução (px). */
  maxSide?: number;
};

/** Escolher/substituir/remover uma foto, com prévia e redução automática. */
export function ImagePicker({ label, currentUrl, onChange, error, aspect = "aspect-[4/3]", maxSide }: Props) {
  const inputId = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (removed ? null : currentUrl);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    setBusy(true);
    try {
      const compressed = await compressImage(file, maxSide);
      setPreview(URL.createObjectURL(compressed));
      setRemoved(false);
      onChange(compressed, false);
    } catch {
      setLocalError("Não foi possível usar esta foto. Envie uma imagem JPG, PNG ou WebP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className={`relative ${aspect} w-full max-w-sm overflow-hidden rounded-2xl border-2 border-dashed border-linha bg-veu`}>
        {shown ? (
          // Prévia local (blob:) ou foto atual: <img> simples, sem otimização, só no painel.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Prévia da foto" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-suave">
            <ImageIcon className="h-10 w-10" />
            <span>Sem foto</span>
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-glace/70">
            <Spinner className="h-8 w-8 text-ameixa" />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor={inputId} className="btn btn-outline btn-sm cursor-pointer">
          {shown ? "Trocar foto" : "Escolher foto"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {shown ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setPreview(null);
              setRemoved(true);
              onChange(null, true);
            }}
          >
            Remover foto
          </button>
        ) : null}
      </div>
      <span className="field-hint">A foto é reduzida automaticamente para carregar rápido.</span>
      {localError || error ? <span className="field-error">{localError ?? error}</span> : null}
    </div>
  );
}
