interface Props {
  label: string;
  value: string;
  description?: string;
}

/** Una metrica: nombre, valor y a que se refiere. */
export function MetricCard({ label, value, description }: Props) {
  return (
    <article className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-400 dark:text-slate-100">{value}</p>
      {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-100">{description}</p>}
    </article>
  );
}
