import { formatMoney } from "@/lib/format";

/** Mostra o preço só quando cadastrado; caso contrário, "a combinar". */
export function PriceTag({ cents, unit, className }: { cents: number | null; unit: string | null; className?: string }) {
  if (cents === null) {
    return <span className={`text-suave ${className ?? ""}`}>Preço a combinar</span>;
  }
  return (
    <span className={className}>
      <span className="font-bold text-calda">{formatMoney(cents)}</span>
      {unit ? <span className="text-suave"> / {unit}</span> : null}
    </span>
  );
}
