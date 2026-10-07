import Link from "next/link";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-ameixa">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 block text-center text-white/85 underline-offset-4 hover:underline">
            Voltar para o site
          </Link>
          <div className="card p-6 sm:p-8">
            <h1 className="font-display text-3xl text-calda">{title}</h1>
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <div className="mt-6 text-center text-white/85">{footer}</div> : null}
        </div>
      </div>
      <div className="scallop-up" style={{ ["--scallop-color" as string]: "var(--color-acucar)" }} aria-hidden="true" />
    </div>
  );
}
