import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn btn-outline btn-sm">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-suave">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="btn btn-outline btn-sm">
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
