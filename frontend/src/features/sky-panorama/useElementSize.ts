import { useEffect, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Mide un elemento y se actualiza cuando cambia de tamano. Uso: `const [ref, size] = useElementSize()` y
 * `<div ref={ref}>`. Hasta la primera medicion devuelve 0 x 0.
 */
export function useElementSize<T extends Element>() {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, size] as const;
}
