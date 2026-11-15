import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Segundos que tarda en recorrerse la ventana completa, dure lo que dure. */
const PLAY_SECONDS = 20;
/** Con movimiento reducido avanza a saltos: uno cada este tiempo... */
const REDUCED_STEP_MS = 600;
/** ...y la ventana se recorre en este numero de saltos. */
const REDUCED_STEPS = 30;

interface Options<T> {
  /**
   * Lo que se esta reproduciendo (las efemerides). Si cambia, la reproduccion se detiene sola: no tiene
   * sentido seguir moviendo el instante sobre otro escenario.
   */
  session: T | null;
  /** Numero de muestras. */
  count: number;
  /** Muestra actual. */
  index: number;
  /** true detiene la reproduccion (p. ej. mientras carga otro escenario). */
  paused: boolean;
  /** Se llama con cada muestra nueva. */
  onStep: (index: number) => void;
}

/**
 * Boton play de la linea de tiempo: avanza el instante con requestAnimationFrame hasta el final de la ventana.
 * Si se pulsa en el final, vuelve a empezar. Con prefers-reduced-motion avanza a saltos en vez de continuo.
 */
export function usePlayback<T>({ session, count, index, paused, onStep }: Options<T>) {
  const [playingSession, setPlayingSession] = useState<T | null>(null);
  const playing = playingSession !== null && playingSession === session && !paused && count > 1;

  // El bucle lee siempre lo ultimo sin reiniciarse en cada paso.
  const indexRef = useRef(index);
  const onStepRef = useRef(onStep);
  /** Ultimo paso que dio el bucle; null = no esta reproduciendo. */
  const emittedRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    indexRef.current = index;
    onStepRef.current = onStep;
  });

  // Si el instante cambia y no fue el bucle (p. ej. clic en el recorrido del panorama), se respeta y se
  // detiene. Se mira al confirmar el render y no en el siguiente cuadro: si el render tarda, el bucle no debe
  // confundir su propio paso con un cambio de fuera.
  useLayoutEffect(() => {
    if (emittedRef.current !== null && index !== emittedRef.current) setPlayingSession(null);
  }, [index]);

  useEffect(() => {
    if (!playing) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const last = count - 1;
    const from = indexRef.current >= last ? 0 : indexRef.current;
    // La posicion sale del reloj, no de contar cuadros: en una maquina lenta se ve a saltos, pero el
    // recorrido dura lo mismo.
    const startedAt = performance.now();
    emittedRef.current = indexRef.current;
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const advanced = reduced
        ? Math.floor(elapsed / REDUCED_STEP_MS) * Math.max(1, Math.round(last / REDUCED_STEPS))
        : Math.floor((elapsed / 1000) * (last / PLAY_SECONDS));

      const next = Math.min(last, from + advanced);
      if (next !== emittedRef.current) {
        emittedRef.current = next;
        onStepRef.current(next);
      }
      if (next >= last) {
        setPlayingSession(null);
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      emittedRef.current = null;
    };
  }, [playing, count]);

  return {
    playing,
    toggle: () => setPlayingSession(playing ? null : session),
    pause: () => setPlayingSession(null),
  };
}
