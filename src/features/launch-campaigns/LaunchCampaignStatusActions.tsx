import { useState } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { MoreHorizontal, Pause, Play, Square } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { IconButton } from '@/shared/ui/IconButton'
import { cn } from '@/shared/lib/utils'
import { centsToLabel } from './money'
import { couponIdFor } from './offer-rules'
import {
  useActivateLaunchCampaign,
  useEndLaunchCampaign,
  useLaunchOfferPreview,
  usePauseLaunchCampaign,
} from './use-launch-campaigns'
import type { LaunchCampaignRow } from './types'

const MOTIVO_MINIMO = 3

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
      onSelect={(e) => {
        e.preventDefault()
        onSelect()
      }}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] outline-none',
        'data-[highlighted]:bg-[var(--canvas-raised)] data-[highlighted]:text-[var(--ink)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      )}
    >
      <span className="text-[var(--ink-faint)]">{icon}</span>
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

function Confirmacion({
  abierto,
  onOpenChange,
  titulo,
  children,
  accion,
  onConfirmar,
  trabajando,
  puedeConfirmar = true,
  peligro,
}: {
  abierto: boolean
  onOpenChange: (v: boolean) => void
  titulo: string
  children: React.ReactNode
  accion: string
  onConfirmar: () => void
  trabajando: boolean
  puedeConfirmar?: boolean
  peligro?: boolean
}) {
  return (
    <AlertDialogPrimitive.Root open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--ink)]/45" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-6 shadow-[0_24px_60px_-20px_oklch(0_0_0_/_0.45)]',
          )}
        >
          <AlertDialogPrimitive.Title className="font-display text-[18px] font-semibold leading-tight tracking-[-0.018em] text-[var(--ink)]">
            {titulo}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description asChild>
            <div className="mt-2 space-y-3 text-[14px] text-[var(--ink-muted)]">{children}</div>
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex flex-row-reverse items-center gap-2">
            <Button
              variant={peligro ? 'danger' : 'primary'}
              disabled={trabajando || !puedeConfirmar}
              onClick={onConfirmar}
            >
              {trabajando ? 'Un momento…' : accion}
            </Button>
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="ghost" disabled={trabajando}>
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

/**
 * Activar · Pausar · Terminar.
 *
 * 🔴 Las tres piden confirmación y las tres dicen QUÉ va a pasar con dinero real:
 * activar crea (o reutiliza) un cupón en Stripe que va a cobrarle a gente, y
 * terminar es irreversible. Un menú que sólo dijera "¿estás seguro?" no informa
 * de nada — por eso el diálogo de activar enseña el id exacto del cupón y el
 * cobro, y el de terminar recuerda que para cambiar el precio se crea otra ficha.
 */
export function LaunchCampaignStatusActions({ campana }: { campana: LaunchCampaignRow }) {
  const [activar, setActivar] = useState(false)
  const [pausar, setPausar] = useState(false)
  const [terminar, setTerminar] = useState(false)
  const [motivoPausa, setMotivoPausa] = useState('')
  const [motivoFin, setMotivoFin] = useState('')

  const activarM = useActivateLaunchCampaign()
  const pausarM = usePauseLaunchCampaign()
  const terminarM = useEndLaunchCampaign()

  // Los montos exactos del diálogo de activar salen del servidor, no de la ficha:
  // un borrador todavía no congeló su precio de lista, y ése es justo el número
  // que el operador necesita ver antes de crear un cupón.
  const cuenta = useLaunchOfferPreview(
    {
      planTier: campana.planTier,
      billingInterval: campana.billingInterval,
      advertisedPriceCents: campana.advertisedPriceCents,
      discountMonths: campana.discountMonths,
    },
    activar,
  )

  const puedeActivar = campana.status === 'DRAFT' || campana.status === 'PAUSED'
  const puedePausar = campana.status === 'ACTIVE'
  const puedeTerminar = campana.status === 'ACTIVE' || campana.status === 'PAUSED'
  const trabajando = activarM.isPending || pausarM.isPending || terminarM.isPending

  const cuponId = campana.stripeCouponId ?? couponIdFor(campana.code, campana.offerVersion)
  const listaCents = cuenta.data?.listPriceCents ?? campana.listPriceCentsSnapshot

  return (
    <div className="flex justify-end">
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <IconButton size="sm" aria-label={`Acciones para ${campana.code}`} disabled={trabajando}>
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
            )}
          >
            <MenuItem
              icon={<Play className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setActivar(true)}
              disabled={!puedeActivar}
            >
              Activar
            </MenuItem>
            <MenuItem
              icon={<Pause className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setPausar(true)}
              disabled={!puedePausar}
            >
              Pausar
            </MenuItem>
            <DropdownMenuPrimitive.Separator className="my-1 h-px bg-[var(--line)]" />
            <MenuItem
              icon={<Square className="h-3.5 w-3.5" aria-hidden />}
              onSelect={() => setTerminar(true)}
              disabled={!puedeTerminar}
            >
              Terminar
            </MenuItem>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      {/* Activar — el diálogo dice el cupón y el cobro exacto, porque a partir
          de aquí hay tarjetas de verdad de por medio. */}
      <Confirmacion
        abierto={activar}
        onOpenChange={setActivar}
        titulo={`Activar ${campana.code}`}
        accion="Activar campaña"
        trabajando={activarM.isPending}
        onConfirmar={() =>
          activarM.mutate({ id: campana.id }, { onSuccess: () => setActivar(false) })
        }
      >
        <p>
          A partir de ahora la landing{' '}
          <span className="tabular">/oferta/{campana.landingSlug}</span> ofrece esta oferta y se
          puede cobrar.
        </p>
        <dl className="space-y-1.5 rounded-[8px] border border-[var(--line-strong)] px-3.5 py-3 text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt>Cupón en Stripe</dt>
            <dd className="tabular font-medium text-[var(--ink)]">{cuponId}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Hoy paga</dt>
            <dd className="tabular font-medium text-[var(--ink)]">
              {centsToLabel(campana.advertisedPriceCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Ciclos con descuento</dt>
            <dd className="tabular text-[var(--ink)]">
              {campana.discountMonths} {campana.discountMonths === 1 ? 'mes' : 'meses'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Después renueva en</dt>
            <dd className="tabular text-[var(--ink)]">
              {cuenta.isFetching && listaCents === null
                ? 'consultando a Stripe…'
                : centsToLabel(listaCents)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>Cupo</dt>
            <dd className="tabular text-[var(--ink)]">
              {campana.redemptionCount} / {campana.redemptionCap}
            </dd>
          </div>
        </dl>
        {cuenta.data?.problems?.length ? (
          <ul className="space-y-1 rounded-[8px] bg-[var(--danger-faint)] px-3.5 py-3 text-[13px] text-[var(--danger)]">
            {cuenta.data.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-[12px] text-[var(--ink-faint)]">
          El cupón nunca se borra: si ya existe con estos montos, se reutiliza.
        </p>
      </Confirmacion>

      {/* Pausar — el motivo es obligatorio: queda en la bitácora y es lo único
          que explica, semanas después, por qué la campaña dejó de vender. */}
      <Confirmacion
        abierto={pausar}
        onOpenChange={setPausar}
        titulo={`Pausar ${campana.code}`}
        accion="Pausar campaña"
        trabajando={pausarM.isPending}
        puedeConfirmar={motivoPausa.trim().length >= MOTIVO_MINIMO}
        onConfirmar={() =>
          pausarM.mutate(
            { id: campana.id, reason: motivoPausa.trim() },
            { onSuccess: () => setPausar(false) },
          )
        }
      >
        <p>
          Deja de ofrecerse en la landing. Quien ya apartó su lugar conserva el precio que aceptó y
          se le cobra igual.
        </p>
        <Field
          name="motivo-pausa"
          label="¿Por qué la pausas?"
          value={motivoPausa}
          onChange={(e) => setMotivoPausa(e.target.value)}
          placeholder="Se agotó el presupuesto del anuncio"
          hint="Queda en la bitácora. Mínimo 3 caracteres."
          autoFocus
        />
      </Confirmacion>

      {/* Terminar — irreversible, y la salida correcta (crear otra ficha) va
          escrita aquí, no en la cabeza de quien la termina. */}
      <Confirmacion
        abierto={terminar}
        onOpenChange={setTerminar}
        titulo={`Terminar ${campana.code}`}
        accion="Terminar campaña"
        peligro
        trabajando={terminarM.isPending}
        puedeConfirmar={motivoFin.trim().length >= MOTIVO_MINIMO}
        onConfirmar={() =>
          terminarM.mutate(
            { id: campana.id, reason: motivoFin.trim() },
            { onSuccess: () => setTerminar(false) },
          )
        }
      >
        <p className="font-medium text-[var(--ink)]">Esto no se puede deshacer.</p>
        <p>
          Una ficha terminada se conserva como historia y no vuelve a ofrecerse ni a editarse. Para
          cambiar el precio, los meses o el plan, se crea otra ficha con otro código.
        </p>
        <Field
          name="motivo-fin"
          label="¿Por qué la terminas?"
          value={motivoFin}
          onChange={(e) => setMotivoFin(e.target.value)}
          placeholder="Terminó la promoción de septiembre"
          hint="Queda en la bitácora. Mínimo 3 caracteres."
          autoFocus
        />
      </Confirmacion>
    </div>
  )
}
