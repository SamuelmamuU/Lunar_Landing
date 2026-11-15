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
        Search sites
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name, mission or agency"
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40"
      />
    </div>
  );
}
