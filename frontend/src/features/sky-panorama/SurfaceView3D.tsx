import { useEffect, useRef, useState } from 'react';
import type { EphemerisSample, HorizonProfile } from '../../shared/types/lunar';
import { LandingHud } from './LandingHud';
import { createSurfaceScene, type SurfaceCameraMode } from './three/surfaceScene';

interface Props {
  horizon: HorizonProfile;
  terrain: boolean;
  samples: EphemerisSample[];
  current: EphemerisSample;
  descentProgress: number;
  isDescending: boolean;
  onToggleDescent: () => void;
  onResetDescent: () => void;
  onSeekDescent: (progress: number) => void;
  className?: string;
}

export function SurfaceView3D({
  horizon,
  terrain,
  samples,
  current,
  descentProgress,
  isDescending,
  onToggleDescent,
  onResetDescent,
  onSeekDescent,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createSurfaceScene> | null>(null);
  const [cameraMode, setCameraMode] = useState<SurfaceCameraMode>('third_person');
  const [verticalScale, setVerticalScale] = useState<number>(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctrl = createSurfaceScene(el);
    sceneRef.current = ctrl;
    return () => {
      ctrl.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update({
      horizon,
      samples,
      current,
      verticalScale,
      descentProgress,
    });
  }, [horizon, samples, current, verticalScale, descentProgress]);

  const handleCameraMode = (mode: SurfaceCameraMode) => {
    setCameraMode(mode);
    sceneRef.current?.setCameraMode(mode);
  };

  return (
    <div className={`relative overflow-hidden rounded-lg bg-[#040710] ${className}`}>
      <div ref={containerRef} className="h-full w-full min-h-80 cursor-grab active:cursor-grabbing" />
      <LandingHud
        current={current}
        siteElevationMeters={horizon.altitudeMeters}
        terrain={terrain}
        cameraMode={cameraMode}
        onChangeCameraMode={handleCameraMode}
        verticalScale={verticalScale}
        onToggleVerticalScale={() => setVerticalScale((s) => (s === 1 ? 5 : 1))}
        descentProgress={descentProgress}
        isDescending={isDescending}
        onToggleDescent={() => {
          if (descentProgress >= 0.995 && !isDescending && cameraMode === 'first_person') {
            handleCameraMode('descent_cam');
          }
          onToggleDescent();
        }}
        onResetDescent={onResetDescent}
        onSeekDescent={onSeekDescent}
        onFocusSun={() => sceneRef.current?.lookAtBody(current.sun.azimuth, current.sun.elevation)}
        onFocusEarth={() => sceneRef.current?.lookAtBody(current.earth.azimuth, current.earth.elevation)}
      />
    </div>
  );
}
