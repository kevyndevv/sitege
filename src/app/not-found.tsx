import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-calda">Página não encontrada.</h1>
        <p className="mt-3 text-suave">O endereço pode ter mudado ou estar incompleto.</p>
        <Link href="/" className="btn btn-primary mt-6">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
