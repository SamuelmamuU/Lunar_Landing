import { Button } from '../../shared/ui/Button';

export type SkyViewMode = '2d' | 'surface3d' | 'orbital3d' | 'dual3d';

interface Props {
  value: SkyViewMode;
  onChange: (mode: SkyViewMode) => void;
}

const MODES: { id: SkyViewMode; label: string }[] = [
  { id: '2d', label: 'Panorama 2D' },
  { id: 'surface3d', label: 'Superficie 3D' },
  { id: 'orbital3d', label: 'Espacio 3D' },
  { id: 'dual3d', label: 'Dual 3D' },
];

export function ViewModeSwitch({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Modo de visualizacion lunar"
      className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/80 p-1"
    >
      {MODES.map((m) => (
        <Button
          key={m.id}
          role="tab"
          aria-selected={value === m.id}
          variant={value === m.id ? 'primary' : 'ghost'}
          size="sm"
          className="text-xs"
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </Button>
      ))}
    </div>
  );
}
