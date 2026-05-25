import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Store,
  Smartphone,
  CreditCard,
  Layers,
  Landmark,
  DollarSign,
  CalendarClock,
  Split,
  Tablet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { inspectApiError } from '@/shared/lib/api-error'
import { SetupCard, type SetupCardState } from './SetupCard'
import { useVenueOptions, useFullSetupBlumon } from './use-merchants'
import {
  VenueDrawer,
  HardwareDrawer,
  MerchantDrawer,
  SlotDrawer,
  RatesDrawer,
  SettlementDrawer,
} from './BlumonSetupDrawers'
import { INITIAL_DRAFT, type BlumonDraft, buildBlumonPayload } from './blumon-setup'

type CardKey = 'venue' | 'hardware' | 'merchant' | 'slot' | 'cost' | 'pricing' | 'settlement'

export function BlumonSetupPanel() {
  const navigate = useNavigate()
  const venuesQ = useVenueOptions()
  const submit = useFullSetupBlumon()
  const [draft, setDraft] = useState<BlumonDraft>(INITIAL_DRAFT)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const patch = (p: Partial<BlumonDraft>) => setDraft((d) => ({ ...d, ...p }))

  const venueDone = !!draft.venueId
  const hardwareDone = !!(draft.serialNumber && draft.brand && draft.model)
  const merchantDone = !!draft.displayName
  const requiredDone = [venueDone, hardwareDone, merchantDone, true].filter(Boolean).length
  const canSubmit = venueDone && hardwareDone && merchantDone

  function st(done: boolean, locked: boolean, optional = false): SetupCardState {
    if (locked) return 'locked'
    return done ? 'done' : optional ? 'pending' : 'pending'
  }

  function handleSubmit() {
    setError(null)
    submit.mutate(buildBlumonPayload(draft), {
      onSuccess: (m) => {
        toast.success('Merchant Blumon creado')
        navigate(`/merchants/${m.id}`)
      },
      onError: (err) => {
        const i = inspectApiError(err, 'crear el merchant')
        setError(i.description)
        toast.error(i.title, { description: i.description })
      },
    })
  }

  const venues = venuesQ.data ?? []

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--canvas)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
        <IconButton size="md" aria-label="Cerrar" onClick={() => navigate('/merchants')}>
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
        <h1 className="font-display text-[16px] font-semibold text-[var(--ink)]">
          Nuevo merchant Blumon
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">
            {requiredDone} de 4 obligatorios
          </span>
          <Button size="sm" disabled={!canSubmit || submit.isPending} onClick={handleSubmit}>
            {submit.isPending ? 'Creando…' : 'Crear merchant'}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {error && (
          <p className="mb-4 text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SetupCard
            icon={Store}
            title="Venue"
            description={draft.venueName ?? 'Selecciona el venue'}
            state={st(venueDone, false)}
            doneLabel={draft.venueName ?? undefined}
            onClick={() => setOpenCard('venue')}
          />
          <SetupCard
            icon={Smartphone}
            title="Terminal Blumon"
            description={
              hardwareDone
                ? `${draft.brand} ${draft.model} · ${draft.serialNumber}`
                : 'Serial + hardware (auto-fetch de credenciales)'
            }
            state={st(hardwareDone, false)}
            doneLabel={hardwareDone ? draft.serialNumber : undefined}
            onClick={() => setOpenCard('hardware')}
          />
          <SetupCard
            icon={CreditCard}
            title="Merchant"
            description={merchantDone ? draft.displayName : 'Nombre de la cuenta a crear'}
            state={st(merchantDone, !hardwareDone)}
            lockedReason="Configura el terminal primero"
            doneLabel={merchantDone ? draft.displayName : undefined}
            onClick={() => setOpenCard('merchant')}
          />
          <SetupCard
            icon={Layers}
            title="Slot"
            description={`Slot de ruteo · ${draft.accountSlot}`}
            state={st(true, !venueDone)}
            lockedReason="Selecciona el venue primero"
            doneLabel={draft.accountSlot}
            onClick={() => setOpenCard('slot')}
          />
          <SetupCard
            icon={Landmark}
            title="Costo del procesador"
            description={draft.cost ? 'Configurado' : 'Opcional — lo que Blumon nos cobra'}
            state={st(!!draft.cost, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
            onClick={() => setOpenCard('cost')}
          />
          <SetupCard
            icon={DollarSign}
            title="Precio al venue"
            description={
              draft.pricing ? 'Configurado' : 'Opcional — lo que Avoqado le cobra al venue'
            }
            state={st(!!draft.pricing, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
            onClick={() => setOpenCard('pricing')}
          />
          <SetupCard
            icon={CalendarClock}
            title="Liquidación"
            description={`T+${draft.settlement.DEBIT}/${draft.settlement.CREDIT}/${draft.settlement.AMEX}/${draft.settlement.INTERNATIONAL} · días hábiles`}
            state="done"
            doneLabel="Listo"
            onClick={() => setOpenCard('settlement')}
          />
          <SetupCard
            icon={Split}
            title="Reparto de ganancias"
            description="Opcional — usa el default (100% Avoqado); configúralo después"
            state={st(false, !merchantDone, true)}
            lockedReason="Configura el merchant primero"
            optional
          />
          <SetupCard
            icon={Tablet}
            title="Terminales TPV"
            description="Se atan por serial; agrega extra desde el detalle"
            state={st(false, !venueDone, true)}
            lockedReason="Selecciona el venue primero"
            optional
          />
        </div>
      </div>

      {openCard === 'venue' && (
        <VenueDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          venues={venues}
          value={draft.venueId}
          onSave={patch}
        />
      )}
      {openCard === 'hardware' && (
        <HardwareDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'merchant' && (
        <MerchantDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'slot' && (
        <SlotDrawer open onOpenChange={() => setOpenCard(null)} draft={draft} onSave={patch} />
      )}
      {openCard === 'cost' && (
        <RatesDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          title="Costo del procesador"
          value={draft.cost}
          includesTax={draft.costIncludesTax}
          onSave={(rates, includesTax) => patch({ cost: rates, costIncludesTax: includesTax })}
        />
      )}
      {openCard === 'pricing' && (
        <RatesDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          title="Precio al venue"
          value={draft.pricing}
          includesTax={draft.pricingIncludesTax}
          onSave={(rates, includesTax) =>
            patch({ pricing: rates, pricingIncludesTax: includesTax })
          }
        />
      )}
      {openCard === 'settlement' && (
        <SettlementDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          draft={draft}
          onSave={(s) => patch({ settlement: s })}
        />
      )}
    </div>
  )
}
