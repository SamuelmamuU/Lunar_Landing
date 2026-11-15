import type { EphemerisSample } from '../../shared/types/lunar';
import { Button } from '../../shared/ui/Button';
import { computeDescentState, type DescentState } from './three/lunar3dMath';
import type { SurfaceCameraMode } from './three/surfaceScene';

interface Props {
  current: EphemerisSample;
  siteElevationMeters: number | null;
  terrain: boolean;
  cameraMode: SurfaceCameraMode;
  onChangeCameraMode: (mode: SurfaceCameraMode) => void;
  verticalScale: number;
  onToggleVerticalScale: () => void;
  descentProgress: number;
  isDescending: boolean;
  onToggleDescent: () => void;
  onResetDescent: () => void;
  onSeekDescent: (progress: number) => void;
  onFocusSun: () => void;
  onFocusEarth: () => void;
}

const PHASE_LABEL: Record<DescentState['phase'], string> = {
  aproximacion: 'Aproximación',
  frenado: 'Frenado principal',
  descenso_final: 'Descenso vertical',
  en_superficie: 'En superficie',
};

const CAMERA_MODES: { id: SurfaceCameraMode; label: string }[] = [
  { id: 'first_person', label: 'Cabina 1ª' },
  { id: 'third_person', label: 'Nave 3ª' },
  { id: 'descent_cam', label: 'Descenso' },
];

export function LandingHud({
  current,
  siteElevationMeters,
  terrain,
  cameraMode,
  onChangeCameraMode,
  verticalScale,
  onToggleVerticalScale,
  descentProgress,
  isDescending,
  onToggleDescent,
  onResetDescent,
  onSeekDescent,
  onFocusSun,
  onFocusEarth,
}: Props) {
  const descent = computeDescentState(descentProgress);
  const blockedAny = current.sun.interference || current.earth.interference;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5">
          <div className="rounded-md border border-slate-700/70 bg-slate-950/78 px-2.5 py-1.5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-sky-300">{PHASE_LABEL[descent.phase]}</span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-100">
                Alt {descent.altitudeMeters >= 100 ? `${Math.round(descent.altitudeMeters)} m` : `${descent.altitudeMeters.toFixed(1)} m`}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-slate-300">Vv {descent.verticalSpeedMs.toFixed(1)} m/s</span>
              {descent.horizontalSpeedMs > 0.1 && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono text-slate-300">Vh {descent.horizontalSpeedMs.toFixed(1)} m/s</span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {terrain ? 'DEM local 64×64 + horizonte LOLA 360°' : 'Esfera lunar lisa (sin relieve local)'}
              {siteElevationMeters !== null && ` · Cota sitio ${Math.round(siteElevationMeters)} m`}
              {verticalScale > 1 && ' · Relieve exagerado 5× (solo inspección)'}
            </p>
          </div>

          {blockedAny && (
            <div className="rounded-md border border-amber-500/50 bg-amber-950/80 px-2.5 py-1 text-[11px] text-amber-200 backdrop-blur-sm">
              Oclusión topográfica:{' '}
              {[
                current.sun.interference && 'Sol bloqueado por cresta lunar',
                current.earth.interference && 'Tierra bloqueada por cresta lunar',
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              (anillo muestra dirección real)
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-md border border-slate-700/70 bg-slate-950/78 p-1 backdrop-blur-sm">
            {CAMERA_MODES.map((m) => (
              <Button
                key={m.id}
                variant={cameraMode === m.id ? 'primary' : 'ghost'}
                size="sm"
                className={cameraMode === m.id ? 'text-xs' : 'text-xs text-slate-300 hover:bg-slate-800 hover:text-white'}
                onClick={() => onChangeCameraMode(m.id)}
              >
                {m.label}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="border border-slate-700/70 bg-slate-950/78 text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={onToggleVerticalScale}
            title="Alternar entre elevacion fisica 1x y exageracion 5x para inspeccionar crateres"
          >
            {verticalScale === 1 ? 'Escala 1× real' : 'Relieve 5×'}
          </Button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-950/80 px-2.5 py-1.5 backdrop-blur-sm">
          <Button variant="primary" size="sm" className="text-xs" onClick={onToggleDescent}>
            {isDescending ? 'Pausar descenso' : descentProgress >= 0.995 ? 'Repetir aterrizaje' : 'Simular aterrizaje'}
          </Button>
          {descentProgress < 0.995 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={onResetDescent}
            >
              A superficie
            </Button>
          )}
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(descentProgress * 1000)}
            aria-label="Progreso del descenso hacia el punto de aterrizaje"
            className="h-1.5 w-24 cursor-pointer accent-blue-500 sm:w-32"
            onChange={(e) => onSeekDescent(Number(e.target.value) / 1000)}
          />
          <span className="font-mono text-[11px] text-slate-300">{Math.round(descentProgress * 100)}%</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-slate-700/70 bg-slate-950/80 p-1 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={onFocusSun}
          >
            <span className="inline-block size-2 rounded-full bg-sun" />
            Enfocar Sol
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            onClick={onFocusEarth}
          >
            <span className="inline-block size-2 rounded-full bg-earth" />
            Enfocar Tierra
          </Button>
        </div>
      </div>
    </>
  );
}
