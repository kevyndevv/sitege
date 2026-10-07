"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <CheckIcon className="h-5 w-5 text-ok" /> : <CopyIcon className="h-5 w-5" />}
      <span aria-live="polite">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
