import { useEffect, useRef, useState } from 'react';
import type { EphemerisSample, OrbitalVectors3D } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { createOrbitalScene, type OrbitalCameraPreset } from './three/orbitalScene';

interface Props {
  lat: number;
  lon: number;
  sample: EphemerisSample;
  vectors3d: OrbitalVectors3D | null;
  descentProgress: number;
  className?: string;
}

const PRESETS: { id: OrbitalCameraPreset; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'south_pole', label: 'South Pole' },
  { id: 'site', label: 'Site' },
];

export function OrbitalView3D({
  lat,
  lon,
  sample,
  vectors3d,
  descentProgress,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createOrbitalScene> | null>(null);
  const [preset, setPreset] = useState<OrbitalCameraPreset>('global');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctrl = createOrbitalScene(el);
    sceneRef.current = ctrl;
    return () => {
      ctrl.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update({ lat, lon, sample, vectors3d, descentProgress });
  }, [lat, lon, sample, vectors3d, descentProgress]);

  const handlePreset = (next: OrbitalCameraPreset) => {
    setPreset(next);
    sceneRef.current?.setPreset(next);
  };

  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#060913] ${className}`}>
      <div ref={containerRef} className="h-full w-full min-h-80 cursor-grab active:cursor-grabbing" />

      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="rounded-md border border-slate-700/70 bg-slate-950/75 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-slate-200">
            Space View · {vectors3d?.frame ?? 'MOON_ME'}
          </p>
          <p className="text-[11px] text-slate-400">
            R = {(vectors3d?.moonRadiusKm ?? 1737.4).toFixed(1)} km · Terminador solar en tiempo real
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-950/75 p-1 backdrop-blur-sm">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              variant={preset === p.id ? 'primary' : 'ghost'}
              size="sm"
              className={preset === p.id ? 'text-xs' : 'text-xs text-slate-300 hover:bg-slate-800 hover:text-white'}
              onClick={() => handlePreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-700/60 bg-slate-950/70 px-2.5 py-1 backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-sun" />
            Sun {sample.sun.visible ? 'visible' : sample.sun.interference ? 'hidden by terrain' : 'below horizon'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-earth" />
            Earth {sample.earth.visible ? 'visible' : sample.earth.interference ? 'hidden by terrain' : 'below horizon'}
          </span>
        </div>
        <span className="rounded-md bg-slate-950/60 px-2 py-0.5 text-slate-400">
          Drag to rotate · Scroll to zoom
        </span>
      </div>
    </div>
  );
}
