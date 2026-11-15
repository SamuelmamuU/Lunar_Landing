interface Props {
  label: string;
  value: string;
  description?: string;
}

/** Una metrica: nombre, valor y a que se refiere. */
export function MetricCard({ label, value, description }: Props) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
    </article>
  );
}
