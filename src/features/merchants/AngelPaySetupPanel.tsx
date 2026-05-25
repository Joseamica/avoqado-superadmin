import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Store,
  Wallet,
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
import { useVenueOptions, useFullSetupAngelPay, useAngelPayAccounts } from './use-merchants'
import {
  VenueDrawer,
  CuentaDrawer,
  MerchantDrawer,
  SlotDrawer,
  SettlementDrawer,
} from './AngelPaySetupDrawers'
import { RatesDrawer } from './SetupDrawerKit'
import { INITIAL_ANGELPAY_DRAFT, type AngelPayDraft, buildAngelPayPayload } from './angelpay-setup'

type CardKey = 'venue' | 'cuenta' | 'merchant' | 'slot' | 'cost' | 'pricing' | 'settlement'

export function AngelPaySetupPanel() {
  const navigate = useNavigate()
  const venuesQ = useVenueOptions()
  const submit = useFullSetupAngelPay()
  const [draft, setDraft] = useState<AngelPayDraft>(INITIAL_ANGELPAY_DRAFT)
  const [openCard, setOpenCard] = useState<CardKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const patch = (p: Partial<AngelPayDraft>) => setDraft((d) => ({ ...d, ...p }))

  const accountsQ = useAngelPayAccounts(draft.venueId ?? undefined)

  const venueDone = !!draft.venueId
  const cuentaDone =
    draft.loginMode === 'existing'
      ? !!draft.angelpayUserAccountId
      : !!draft.email && draft.pin.length === 6
  const merchantDone = !!(
    draft.externalMerchantId &&
    draft.merchantName &&
    draft.affiliation &&
    draft.displayName
  )
  const slotValid = draft.slotMode !== 'replace' || !!draft.replacedAccountId

  const requiredDone = [venueDone, cuentaDone, merchantDone, slotValid].filter(Boolean).length
  const canSubmit = venueDone && cuentaDone && merchantDone && slotValid

  function st(done: boolean, locked: boolean, optional = false): SetupCardState {
    if (locked) return 'locked'
    return done ? 'done' : optional ? 'pending' : 'pending'
  }

  function handleSubmit() {
    setError(null)
    submit.mutate(buildAngelPayPayload(draft), {
      onSuccess: (m) => {
        toast.success('Merchant AngelPay creado')
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
  const accounts = accountsQ.data ?? []
  const s = draft.settlement

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--canvas)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
        <IconButton size="md" aria-label="Cerrar" onClick={() => navigate('/merchants')}>
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
        <h1 className="font-display text-[16px] font-semibold text-[var(--ink)]">
          Nuevo merchant AngelPay
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">
            {requiredDone} de 4 obligatorios
          </span>
          <Button size="sm" disabled={!canSubmit || submit.isPending} onClick={handleSubmit}>
            {submit.isPending ? 'Activando…' : 'Activar merchant'}
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
            icon={Wallet}
            title="Cuenta AngelPay"
            description={
              cuentaDone
                ? draft.loginMode === 'existing'
                  ? (accounts.find((a) => a.id === draft.angelpayUserAccountId)?.email ??
                    'Login del adquirente')
                  : draft.email || 'Login del adquirente'
                : 'Login del adquirente'
            }
            state={st(cuentaDone, !venueDone)}
            lockedReason="Selecciona el venue primero"
            doneLabel={
              cuentaDone
                ? draft.loginMode === 'existing'
                  ? (accounts.find((a) => a.id === draft.angelpayUserAccountId)?.email ??
                    'Cuenta existente')
                  : draft.email
                : undefined
            }
            onClick={() => setOpenCard('cuenta')}
          />
          <SetupCard
            icon={CreditCard}
            title="Merchant"
            description={merchantDone ? draft.displayName : 'Nombre del merchant a crear'}
            state={st(merchantDone, !cuentaDone)}
            lockedReason="Configura la cuenta primero"
            doneLabel={merchantDone ? draft.displayName : undefined}
            onClick={() => setOpenCard('merchant')}
          />
          <SetupCard
            icon={Layers}
            title="Slot"
            description={`Slot de ruteo · ${draft.accountType}`}
            state={st(!venueDone ? false : slotValid, !venueDone)}
            lockedReason="Selecciona el venue primero"
            doneLabel={slotValid ? draft.accountType : undefined}
            onClick={() => setOpenCard('slot')}
          />
          <SetupCard
            icon={Landmark}
            title="Costo del procesador"
            description={draft.cost ? 'Configurado' : 'Opcional — lo que AngelPay nos cobra'}
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
            description={`T+${s.DEBIT}/${s.CREDIT}/${s.AMEX}/${s.INTERNATIONAL} · días hábiles`}
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
      {openCard === 'cuenta' && (
        <CuentaDrawer
          open
          onOpenChange={() => setOpenCard(null)}
          draft={draft}
          accounts={accounts}
          onSave={patch}
        />
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
          onSave={(p) => patch(p)}
        />
      )}
    </div>
  )
}
