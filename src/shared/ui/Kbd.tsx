import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-1 font-mono text-[10.5px] text-[var(--ink-muted)]',
        className,
      )}
      {...props}
    />
  )
}
