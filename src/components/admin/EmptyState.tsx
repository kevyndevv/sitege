export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ameixa-clara/60 bg-glace px-6 py-12 text-center">
      <p className="font-display text-2xl text-tinta">{title}</p>
      {children ? <div className="text-suave">{children}</div> : null}
    </div>
  );
}
