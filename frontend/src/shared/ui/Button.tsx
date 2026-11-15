import type { ButtonHTMLAttributes, Ref } from 'react';

type Variant = 'primary' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** React 19: ref es una prop mas (p. ej. para mover el foco al boton). */
  ref?: Ref<HTMLButtonElement>;
}

// El color de las acciones vive SOLO aqui. Para cambiar el acento de la app, cambiar 'primary'.
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  ghost: 'font-medium text-slate-600 hover:bg-slate-200',
  /** Boton con aspecto de enlace (hereda el color del texto). Ignora `size`. */
  link: 'font-semibold underline underline-offset-2 text-sm',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-3 py-1.5 text-sm',
  /** Boton cuadrado con solo un icono: lleva siempre aria-label (y title para el tooltip). */
  icon: 'p-1.5',
};

/** Boton base de la app. Usar siempre este en vez de estilizar <button> a mano. */
export function Button({ variant = 'primary', size = 'md', type = 'button', className = '', ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2 disabled:opacity-50 ${VARIANT_CLASS[variant]} ${variant === 'link' ? '' : SIZE_CLASS[size]} ${className}`}
      {...props}
    />
  );
}
