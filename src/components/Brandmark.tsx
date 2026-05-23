import { cn } from '@/lib/utils'

export function Brandmark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <span
        aria-hidden
        className="grid h-6 w-6 place-items-center rounded-[4px] bg-[var(--accent)] text-[var(--canvas)] font-display text-[13px] font-bold leading-none"
      >
        A
      </span>
      <div className="flex flex-col leading-none">
        <span className="font-display text-[14px] font-semibold tracking-[-0.018em] text-[var(--ink)]">
          Avoqado
        </span>
        <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
          Superadmin
        </span>
      </div>
    </div>
  )
}
