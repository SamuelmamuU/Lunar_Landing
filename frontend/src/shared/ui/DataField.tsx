interface Props {
  label: string;
  value: string;
}

/** Par etiqueta/valor. Usar dentro de un <dl>. */
export function DataField({ label, value }: Props) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
