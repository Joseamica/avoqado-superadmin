import { useState } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { CalendarClock, Gift, MoreHorizontal, Power, PowerOff } from 'lucide-react'
import { IconButton } from '@/shared/ui/IconButton'
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
import { cn } from '@/shared/lib/utils'
import { useSubscriptionActions } from './use-subscriptions'
import type { SuperadminVenueSubscription } from './types'

/**
 * Acciones de gestión por fila para la tabla de suscripciones (SUPERADMIN).
 * Menú "⋯" con: Activar (directo), Desactivar (confirm), Dar días gratis
 * (diálogo con input) y Ajustar fin (diálogo con input que acepta negativos).
 *
 * Los overlays de menú/confirm usan los primitives de Radix directamente,
 * estilados con los mismos tokens OKLCH que el resto del design system, para
 * no tener que tocar `src/shared/ui` (este feature no exporta primitives nuevos).
 */
export function SubscriptionRowActions({ row }: { row: SuperadminVenueSubscription }) {
  const { activate, deactivate, grantTrial, adjustEndDate } = useSubscriptionActions()

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [trialOpen, setTrialOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [trialDays, setTrialDays] = useState('14')
  const [deltaDays, setDeltaDays] = useState('30')

  const anyPending =
    activate.isPending || deactivate.isPending || grantTrial.isPending || adjustEndDate.isPending

  const isActiveTarget = activate.isPending && activate.variables === row.venueId
  const isDeactivateTarget = deactivate.isPending && deactivate.variables === row.venueId

  const trialNum = Number.parseInt(trialDays, 10)
  const trialValid = Number.isInteger(trialNum) && trialNum > 0

  const deltaNum = Number.parseInt(deltaDays, 10)
  const deltaValid = Number.isInteger(deltaNum) && deltaNum !== 0

  function handleGrantTrial() {
    if (!trialValid) return
    grantTrial.mutate(
      { venueId: row.venueId, days: trialNum },
      { onSuccess: () => setTrialOpen(false) },
    )
  }

  function handleAdjust() {
    if (!deltaValid) return
    adjustEndDate.mutate(
      { venueId: row.venueId, deltaDays: deltaNum },
      { onSuccess: () => setAdjustOpen(false) },
    )
  }

  return (
    <div className="flex justify-end">
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <IconButton
            size="sm"
            aria-label={`Acciones para ${row.name}`}
            disabled={isActiveTarget || isDeactivateTarget}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </IconButton>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            className={cn(
              'z-50 min-w-[200px] overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-1 text-[var(--ink)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.55)]',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            )}
          >
            <MenuItem
              icon={<Power className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => activate.mutate(row.venueId)}
              disabled={anyPending}
            >
              Activar
            </MenuItem>
            <MenuItem
              icon={<PowerOff className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setConfirmDeactivate(true)}
              disabled={anyPending}
            >
              Desactivar
            </MenuItem>
            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[var(--line)]" />
            <MenuItem
              icon={<Gift className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setTrialOpen(true)}
              disabled={anyPending}
            >
              Dar días gratis
            </MenuItem>
            <MenuItem
              icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setAdjustOpen(true)}
              disabled={anyPending}
            >
              Ajustar fin (+/- días)
            </MenuItem>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      {/* Desactivar — confirm */}
      <AlertDialogPrimitive.Root open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--ink)]/45" />
          <AlertDialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2',
              'rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-6 shadow-[0_24px_60px_-20px_oklch(0_0_0_/_0.45)]',
            )}
          >
            <AlertDialogPrimitive.Title className="font-display text-[18px] font-semibold leading-tight tracking-[-0.018em] text-[var(--ink)]">
              Desactivar plan · {row.name}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-1 text-[14px] text-[var(--ink-muted)]">
              Esto deja al venue en plan básico. ¿Continuar?
            </AlertDialogPrimitive.Description>
            <div className="mt-6 flex flex-row-reverse items-center gap-2">
              <Button
                variant="danger"
                disabled={deactivate.isPending}
                onClick={() =>
                  deactivate.mutate(row.venueId, {
                    onSuccess: () => setConfirmDeactivate(false),
                  })
                }
              >
                {deactivate.isPending ? 'Desactivando…' : 'Desactivar'}
              </Button>
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="ghost" disabled={deactivate.isPending}>
                  Cancelar
                </Button>
              </AlertDialogPrimitive.Cancel>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>

      {/* Dar días gratis */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dar días gratis · {row.name}</DialogTitle>
            <DialogDescription>
              Otorga un periodo de prueba. El plan se renovará al terminar los días.
            </DialogDescription>
          </DialogHeader>
          <Field
            name="trial-days"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            label="Días de prueba"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trialValid) handleGrantTrial()
            }}
            hint="Número entero positivo (ej. 14)."
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleGrantTrial} disabled={!trialValid || grantTrial.isPending}>
              {grantTrial.isPending ? 'Otorgando…' : 'Otorgar días'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setTrialOpen(false)}
              disabled={grantTrial.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ajustar fin (+/- días) */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar fin · {row.name}</DialogTitle>
            <DialogDescription>
              Mueve la fecha de fin del plan. Positivo extiende, negativo recorta.
            </DialogDescription>
          </DialogHeader>
          <Field
            name="delta-days"
            type="number"
            step={1}
            inputMode="numeric"
            label="Días (+/-)"
            value={deltaDays}
            onChange={(e) => setDeltaDays(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && deltaValid) handleAdjust()
            }}
            hint="Entero distinto de cero (ej. 30 o -7)."
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleAdjust} disabled={!deltaValid || adjustEndDate.isPending}>
              {adjustEndDate.isPending ? 'Ajustando…' : 'Ajustar fin'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setAdjustOpen(false)}
              disabled={adjustEndDate.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Item del menú de acciones — icono + label, estilo consistente con el design system. */
function MenuItem({
  icon,
  children,
  onSelect,
  disabled,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[13px] text-[var(--ink-muted)] outline-none',
        'focus:bg-[var(--canvas-raised)] focus:text-[var(--ink)]',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
      )}
    >
      <span className="text-[var(--ink-faint)]">{icon}</span>
      {children}
    </DropdownMenuPrimitive.Item>
  )
}
