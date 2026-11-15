interface Props {
  label: string;
  value: string;
  /** 'accent' resalta el valor con el color de datos (datos de la mision). */
  tone?: 'default' | 'accent';
}

/** Par etiqueta/valor. Usar dentro de un <dl>. */
export function DataField({ label, value, tone = 'default' }: Props) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`truncate ${tone === 'accent' ? 'text-teal-800' : 'font-medium text-slate-900'}`} title={value}>
        {value}
      </dd>
    </div>
  );
}
