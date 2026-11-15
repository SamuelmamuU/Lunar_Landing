
interface Props {
  label: string;
  value: string;
  description?: string;
}

export function MetricCard({ label, value, description }: Props) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </article>
  );
}
