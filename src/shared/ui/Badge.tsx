import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'
type Size = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: Size
}

const toneStyles: Record<Tone, string> = {
  muted: 'bg-[var(--line)] text-[var(--ink-muted)]',
  success: 'bg-[var(--success-faint)] text-[var(--success)]',
  warn: 'bg-[var(--warn-faint)] text-[var(--warn)]',
  danger: 'bg-[var(--danger-faint)] text-[var(--danger)]',
  info: 'bg-[var(--info-faint)] text-[var(--info)]',
  accent: 'bg-[var(--accent-faint)] text-[var(--accent)]',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-[18px] px-1.5 text-[10px]',
  md: 'h-5 px-2 text-[11px]',
}

/**
 * Badge — el único primitive para CUALQUIER pill/etiqueta del repo: status
 * ("Activo"), tipo ("TPV Android"), micro-tags ("Se encolará"), indicadores
 * ("Live"). Siempre pill (`rounded-full`), sin borde, con tint del tono — la
 * forma vive aquí, no inline (regla "Badges pill-shaped sin bordes" del
 * `.impeccable.md`). Usa `size="sm"` para los chiquitos (10px); `md` es default.
 * Acepta children con icono — el `gap-1` los separa del texto.
 */
export function Badge({ className, tone = 'muted', size = 'md', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium',
        sizeStyles[size],
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  )
}
