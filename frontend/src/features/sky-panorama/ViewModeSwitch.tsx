import { Button } from '../../shared/ui/Button';

export type SkyViewMode = '2d' | 'surface3d' | 'orbital3d' | 'dual3d' | 'metrics';

interface Props {
  value: SkyViewMode;
  onChange: (mode: SkyViewMode) => void;
  /** Sin contenido para la pestana de metricas, no se ofrece. */
  showMetrics: boolean;
}

const MODES: { id: SkyViewMode; label: string }[] = [
  { id: '2d', label: '2D panorama' },
  { id: 'surface3d', label: '3D surface' },
  { id: 'orbital3d', label: '3D space' },
  { id: 'dual3d', label: 'Dual 3D' },
  { id: 'metrics', label: 'Metrics' },
];

export function ViewModeSwitch({ value, onChange, showMetrics }: Props) {
  const modes = showMetrics ? MODES : MODES.filter((m) => m.id !== 'metrics');
  return (
    <div
      role="tablist"
      aria-label="Lunar view mode"
      className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-200/80 p-1"
    >
      {modes.map((m) => (
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
