import { useId } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SiteSearch({ value, onChange }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        Buscar sitio
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nombre, mision o agencia"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-600/40"
      />
    </div>
  );
}
