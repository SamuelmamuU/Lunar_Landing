// Tema claro / oscuro (sin React). El tema es la clase .dark en <html>: la pone el script de index.html antes de
// pintar (eleccion guardada o, si no hay, la del sistema) y la cambia setTheme. La paleta oscura vive en index.css.

export type Theme = 'light' | 'dark';

/** Clave en localStorage. El script de index.html lee la misma: si se cambia aqui, cambiarla alla. */
export const THEME_STORAGE_KEY = 'lunar-theme';

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** Aplica el tema y lo recuerda en este navegador (a partir de ahi ya no sigue al sistema). */
export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): el cambio vale solo para esta visita.
  }
}

/** Avisa cuando cambia el tema, venga de setTheme o del sistema (el script de index.html cambia la clase). */
export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
