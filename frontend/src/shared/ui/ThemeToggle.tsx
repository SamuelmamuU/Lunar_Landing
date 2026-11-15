import { useSyncExternalStore } from 'react';
import { currentTheme, setTheme, subscribeTheme } from '../lib/theme';
import { Button } from './Button';
import { MoonIcon } from './icons/MoonIcon';
import { LightModeIcon } from './icons/LightModeIcon';

/**
 * Cambia entre modo claro y oscuro. Solo icono: muestra a que modo se cambia (luna = pasar a oscuro, sol = pasar a
 * claro). Lee el tema de <html>, asi va siempre al dia aunque lo cambie el sistema u otro boton igual.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light' as const);
  const isDark = theme === 'dark';
  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={label} title={label}>
      {isDark ? <LightModeIcon /> : <MoonIcon />}
    </Button>
  );
}
