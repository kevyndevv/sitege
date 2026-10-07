"use client";

import Link from "next/link";

/** Erro inesperado: mensagem amigável, sem detalhes técnicos. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-calda">Algo não saiu como esperado.</h1>
        <p className="mt-3 text-suave">Tente de novo em instantes. Se estava fazendo um pedido, ele não foi enviado.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Tentar de novo
          </button>
          <Link href="/" className="btn btn-outline">
            Ir para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
