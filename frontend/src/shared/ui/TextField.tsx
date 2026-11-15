import { useId, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'> {
  label: string;
  /** Texto gris junto al label, por ejemplo "(opcional)" o "(-90 a 90)". */
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  /** Mensaje de error; si existe, el campo se marca en rojo y se anuncia a lectores de pantalla. */
  error?: string | null;
}

/** Campo de texto con label, pista y mensaje de error accesibles. */
export function TextField({ label, hint, value, onChange, error, className = '', ...inputProps }: Props) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label} {hint && <span className="font-normal text-slate-500">({hint})</span>}
      </label>
      <input
        {...inputProps}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`mt-1 w-full rounded-md border bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-400 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 ${
          error
            ? 'border-red-600 focus-visible:ring-red-600/40'
            : 'border-slate-200 dark:border-slate-700 focus:border-blue-600 focus-visible:ring-blue-600/40'
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
