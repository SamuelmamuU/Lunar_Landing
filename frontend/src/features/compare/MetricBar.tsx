interface Props {
  /** 0..1 */
  fraction: number;
  /** El mejor de la fila va en tinta oscura; el resto en gris. */
  emphasized: boolean;
}

/** Barra fina bajo el valor de una celda. Decorativa: el numero ya esta en texto. */
export function MetricBar({ fraction, emphasized }: Props) {
  return (
    <div aria-hidden="true" className="mt-1.5 h-1 w-full max-w-36 rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${emphasized ? 'bg-slate-800' : 'bg-slate-400'}`}
        // Ancho calculado: el unico estilo en linea permitido.
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
