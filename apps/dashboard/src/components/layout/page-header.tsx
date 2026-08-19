export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      data-slot="page-header"
      className="relative overflow-hidden border-b border-white/[0.07] pb-5"
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00cec9]/80">
        <span className="h-px w-5 bg-[#00cec9]/60" />
        Control Center
      </div>
      <h1 className="text-2xl font-bold tracking-[-0.035em] text-zinc-50">
        {title}
      </h1>
      {description && (
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">
          {description}
        </p>
      )}
    </div>
  );
}
