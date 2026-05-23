import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

const toneStyles: Record<Tone, string> = {
  muted:
    'bg-[var(--canvas-sunken)] text-[var(--ink-muted)] border-[var(--line-strong)]',
  success:
    'bg-[var(--success-faint)] text-[var(--success)] border-[var(--success)]/25',
  warn:
    'bg-[var(--warn-faint)] text-[oklch(0.45_0.12_75)] border-[var(--warn)]/30',
  danger:
    'bg-[var(--danger-faint)] text-[var(--danger)] border-[var(--danger)]/25',
  info:
    'bg-[var(--info-faint)] text-[var(--info)] border-[var(--info)]/25',
  accent:
    'bg-[var(--accent-faint)] text-[var(--accent)] border-[var(--accent-line)]',
}

export function Badge({ className, tone = 'muted', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[4px] border px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]',
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  )
}
