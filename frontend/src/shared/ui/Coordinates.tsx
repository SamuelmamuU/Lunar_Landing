import { formatLat, formatLon } from '../lib/coords';

interface Props {
  lat: number;
  lon: number;
  /** Decimales a mostrar. */
  digits?: number;
  /** 'inline' para listas, 'chip' para destacarlas en tarjetas. */
  variant?: 'inline' | 'chip';
}

/** Coordenadas lunares formateadas ("89.45° S, 137.30° O") con el color de datos (teal). */
export function Coordinates({ lat, lon, digits = 2, variant = 'inline' }: Props) {
  const text = `${formatLat(lat, digits)}, ${formatLon(lon, digits)}`;
  if (variant === 'chip') {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md bg-teal-50 px-2 py-0.5 text-sm tabular-nums text-green-700 ring-1 ring-inset ring-teal-200">
        {text}
      </span>
    );
  }
  return <span className="whitespace-nowrap tabular-nums text-green-700">{text}</span>;
}
