import type { LucideIcon } from 'lucide-react'
import { Check, Lock } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'

export type SetupCardState = 'pending' | 'done' | 'locked'

interface SetupCardProps {
  icon: LucideIcon
  title: string
  description: string
  state: SetupCardState
  lockedReason?: string
  doneLabel?: string
  optional?: boolean
  onClick?: () => void
}

export function SetupCard({
  icon: Icon,
  title,
  description,
  state,
  lockedReason,
  doneLabel,
  optional,
  onClick,
}: SetupCardProps) {
  const disabled = state === 'locked' || !onClick
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-[10px] border p-5 text-left transition-colors',
        state === 'locked'
          ? 'cursor-not-allowed border-dashed border-[var(--line)] opacity-60'
          : 'border-[var(--line-strong)] bg-[var(--canvas)] hover:border-[var(--accent-line)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
          <span className="text-[14px] font-semibold text-[var(--ink)]">{title}</span>
        </div>
        {state === 'done' ? (
          <Badge tone="success" size="sm">
            <Check className="h-3 w-3" aria-hidden /> {doneLabel ?? 'Listo'}
          </Badge>
        ) : state === 'locked' ? (
          <Badge tone="muted" size="sm">
            <Lock className="h-3 w-3" aria-hidden /> {lockedReason ?? 'Bloqueado'}
          </Badge>
        ) : (
          <Badge tone={optional ? 'muted' : 'warn'} size="sm">
            {optional ? 'Opcional' : 'Pendiente'}
          </Badge>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--ink-muted)]">{description}</p>
    </button>
  )
}
