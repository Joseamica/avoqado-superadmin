import { useState } from 'react'
import { CreditCard, Gift, ShieldCheck, Sparkles } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime, formatRelative } from '@/shared/lib/datetime'
import { cn } from '@/shared/lib/utils'
import { useVenuePlan, useVenuePlanActions } from './use-venues'
import type { CompPlanTier, TrialPlanTier } from './api'
import { humanizePlanState, humanizePlanTier, PLAN_STATE_TONE, type VenuePlanState } from './types'

/**
 * Sección "Plan" del detalle de venue — el plan-admin del superadmin:
 * tier actual + estado, badge GRANDFATHERED, y tres acciones (toggle
 * grandfathered con confirmación, asignar plan comp permanente, otorgar
 * días de prueba). Vive en su propio archivo para no empujar
 * `VenueDetailPage.tsx` arriba del límite de 500 líneas del repo.
 *
 * El wrapper de sección replica el markup del `Section` local de
 * `VenueDetailPage` (que no se exporta — exportarlo crearía un import
 * circular página ↔ sección).
 */
export function VenuePlanSection({ venueId }: { venueId: string }) {
  const query = useVenuePlan(venueId)

  return (
    <section className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas)]">
      <header className="border-b border-[var(--line)] px-5 py-3">
        <h2 className="font-display text-[14px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
          Plan
        </h2>
      </header>
      <div className="px-5 py-4">
        {query.isError ? (
          <QueryError
            error={query.error}
            context="cargar el plan del venue"
            onRetry={() => query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : query.data ? (
          <PlanBody venueId={venueId} plan={query.data} />
        ) : (
          <PlanSkeleton />
        )}
      </div>
    </section>
  )
}

function PlanSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      <div className="h-5 w-40 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
      <div className="h-4 w-56 animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
      <div className="h-8 w-full animate-pulse rounded-[4px] bg-[var(--canvas-sunken)]" />
    </div>
  )
}

function PlanRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-b-0">
      <p className="label shrink-0">{label}</p>
      <div className="flex min-w-0 items-center justify-end gap-1.5 text-right text-[13px] text-[var(--ink)]">
        {value}
      </div>
    </div>
  )
}

function PlanBody({ venueId, plan }: { venueId: string; plan: VenuePlanState }) {
  const actions = useVenuePlanActions(venueId)
  const [grandfatheredOpen, setGrandfatheredOpen] = useState(false)
  const [compOpen, setCompOpen] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)

  const anyPending =
    actions.toggleGrandfathered.isPending ||
    actions.assignComp.isPending ||
    actions.grantTrial.isPending

  return (
    <div>
      <PlanRow
        label="Tier"
        value={
          <>
            <span className="font-medium">{humanizePlanTier(plan.planTier)}</span>
            {plan.planName && plan.planTier && (
              <span className="text-[11.5px] text-[var(--ink-faint)]">({plan.planName})</span>
            )}
          </>
        }
      />
      <PlanRow
        label="Estado"
        value={<Badge tone={PLAN_STATE_TONE[plan.state]}>{humanizePlanState(plan.state)}</Badge>}
      />
      {plan.trialEndsAt && (
        <PlanRow
          label="Prueba termina"
          value={
            <span className="tabular">
              {formatRelative(plan.trialEndsAt)} · {formatDateTime(plan.trialEndsAt)}
            </span>
          }
        />
      )}
      <PlanRow
        label="Stripe"
        value={
          plan.stripeSubscriptionId ? (
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3 w-3 text-[var(--ink-faint)]" aria-hidden />
              <code className="font-mono text-[12px]">{plan.stripeSubscriptionId}</code>
            </span>
          ) : (
            <span className="text-[var(--ink-muted)]">Sin suscripción (manual/comp)</span>
          )
        }
      />

      {plan.grandfathered && (
        <div className="mt-3 rounded-[6px] border border-[var(--accent)]/30 bg-[var(--accent-faint)] px-3 py-2.5">
          <Badge tone="accent">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Grandfathered (legacy)
          </Badge>
          <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">
            Exento de paywalls y del límite de usuarios — opera como antes del modelo de planes.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={anyPending}
          onClick={() => setGrandfatheredOpen(true)}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {plan.grandfathered ? 'Quitar grandfathered' : 'Marcar grandfathered'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={anyPending}
          onClick={() => setCompOpen(true)}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Asignar plan comp
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={anyPending}
          onClick={() => setTrialOpen(true)}
        >
          <Gift className="h-3.5 w-3.5" aria-hidden />
          Dar días de prueba
        </Button>
      </div>

      <GrandfatheredDialog
        open={grandfatheredOpen}
        onOpenChange={setGrandfatheredOpen}
        grandfathered={plan.grandfathered}
        mutation={actions.toggleGrandfathered}
      />
      <CompPlanDialog open={compOpen} onOpenChange={setCompOpen} mutation={actions.assignComp} />
      <TrialDialog open={trialOpen} onOpenChange={setTrialOpen} mutation={actions.grantTrial} />
    </div>
  )
}

/* ─── Diálogos ─── */

interface DialogBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GrandfatheredDialog({
  open,
  onOpenChange,
  grandfathered,
  mutation,
}: DialogBaseProps & {
  grandfathered: boolean
  mutation: ReturnType<typeof useVenuePlanActions>['toggleGrandfathered']
}) {
  const next = !grandfathered
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{next ? 'Marcar como grandfathered' : 'Quitar grandfathered'}</DialogTitle>
          <DialogDescription>
            {next
              ? 'El venue operará sin paywalls ni límites de usuarios, como antes del modelo de planes.'
              : 'El venue entra al modelo de planes: cap de 2 usuarios en Free y paywalls Pro/Premium.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant={next ? 'primary' : 'danger'}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(next, { onSuccess: () => onOpenChange(false) })}
          >
            {mutation.isPending ? 'Guardando…' : next ? 'Marcar grandfathered' : 'Quitar'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Botón de selección de tier — aria-pressed para accesibilidad y tests. */
function TierOption({
  label,
  selected,
  onSelect,
  disabled,
}: {
  label: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'h-9 flex-1 rounded-[6px] border text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-[var(--accent)] bg-[var(--accent-faint)] text-[var(--accent)]'
          : 'border-[var(--line-strong)] text-[var(--ink-muted)] hover:border-[var(--ink-faint)] hover:text-[var(--ink)]',
      )}
    >
      {label}
    </button>
  )
}

const COMP_TIER_LABEL: Record<CompPlanTier, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  PREMIUM: 'Premium',
}

function CompPlanDialog({
  open,
  onOpenChange,
  mutation,
}: DialogBaseProps & { mutation: ReturnType<typeof useVenuePlanActions>['assignComp'] }) {
  const [tier, setTier] = useState<CompPlanTier>('PRO')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar plan comp</DialogTitle>
          <DialogDescription>
            Plan permanente sin cobro ni vencimiento (no crea suscripción de Stripe). Free remueve
            el plan base.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2" role="group" aria-label="Tier del plan comp">
          {(Object.keys(COMP_TIER_LABEL) as CompPlanTier[]).map((t) => (
            <TierOption
              key={t}
              label={COMP_TIER_LABEL[t]}
              selected={tier === t}
              onSelect={() => setTier(t)}
              disabled={mutation.isPending}
            />
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(tier, { onSuccess: () => onOpenChange(false) })}
          >
            {mutation.isPending ? 'Asignando…' : `Asignar ${COMP_TIER_LABEL[tier]}`}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const TRIAL_TIER_LABEL: Record<TrialPlanTier, string> = { PRO: 'Pro', PREMIUM: 'Premium' }

function TrialDialog({
  open,
  onOpenChange,
  mutation,
}: DialogBaseProps & { mutation: ReturnType<typeof useVenuePlanActions>['grantTrial'] }) {
  const [tier, setTier] = useState<TrialPlanTier>('PRO')
  // String controlado — el input se puede vaciar sin atorarse en "0" (mismo
  // patrón que SubscriptionRowActions del feature subscriptions).
  const [days, setDays] = useState('14')

  const daysNum = Number.parseInt(days, 10)
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 365

  function handleGrant() {
    if (!daysValid) return
    mutation.mutate({ tier, days: daysNum }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dar días de prueba</DialogTitle>
          <DialogDescription>
            Otorga acceso temporal a un tier de pago. Al terminar los días, el venue regresa a su
            plan anterior.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2" role="group" aria-label="Tier de la prueba">
            {(Object.keys(TRIAL_TIER_LABEL) as TrialPlanTier[]).map((t) => (
              <TierOption
                key={t}
                label={TRIAL_TIER_LABEL[t]}
                selected={tier === t}
                onSelect={() => setTier(t)}
                disabled={mutation.isPending}
              />
            ))}
          </div>
          <Field
            name="trial-days"
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            label="Días de prueba"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && daysValid) handleGrant()
            }}
            hint="Entero entre 1 y 365 (ej. 14)."
            error={days !== '' && !daysValid ? 'Debe ser un entero entre 1 y 365.' : undefined}
          />
        </div>
        <DialogFooter>
          <Button disabled={!daysValid || mutation.isPending} onClick={handleGrant}>
            {mutation.isPending ? 'Otorgando…' : 'Otorgar días'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
