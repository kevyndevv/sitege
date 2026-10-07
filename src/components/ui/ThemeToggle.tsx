"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { MoonIcon, SunIcon } from "@/components/icons";

type Theme = "light" | "dark";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Botão de lua/sol para alternar entre modo claro e modo noturno. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // sem armazenamento: vale só para esta visita
        }
      }}
      className={
        className ??
        "inline-flex h-11 w-11 items-center justify-center rounded-full text-tinta hover:bg-veu"
      }
      aria-label={next === "dark" ? "Ativar modo noturno" : "Ativar modo claro"}
      title={next === "dark" ? "Modo noturno" : "Modo claro"}
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
