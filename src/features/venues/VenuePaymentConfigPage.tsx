import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, ArrowDown, X, Check, AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Combobox } from '@/shared/ui/Combobox'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { buttonVariants } from '@/shared/ui/button-variants'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useVenueDetail,
  useVenuePaymentConfig,
  useMerchantAccountOptions,
  useVenueTerminalBrands,
  useSaveVenuePaymentConfig,
} from './use-venues'
import { isProviderCompatible } from './payment-compat'
import type { MerchantAccountOption, PreferredProcessor } from './api'

const PROCESSORS: PreferredProcessor[] = ['AUTO', 'LEGACY', 'MENTA', 'CLIP', 'BANK_DIRECT']
const SLOT_LABELS = ['Principal', 'Secundaria', 'Terciaria']
const MAX_SLOTS = 3

export function VenuePaymentConfigPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()

  const venueQ = useVenueDetail(venueId)
  const configQ = useVenuePaymentConfig(venueId)
  const optionsQ = useMerchantAccountOptions()
  const brandsQ = useVenueTerminalBrands(venueId)
  const save = useSaveVenuePaymentConfig(venueId ?? '')

  // Modelo ordenado: slots[0] = Principal, [1] = Secundaria, [2] = Terciaria.
  // Reordenar la lista cambia qué cuenta ocupa cada slot — directo y entendible.
  const [slots, setSlots] = useState<string[]>([])
  const [processor, setProcessor] = useState<PreferredProcessor>('AUTO')
  const [formError, setFormError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  if (!hydrated && configQ.isSuccess) {
    setHydrated(true)
    const c = configQ.data
    if (c) {
      setSlots(
        [c.primaryAccountId, c.secondaryAccountId, c.tertiaryAccountId].filter(
          (v): v is string => !!v,
        ),
      )
      setProcessor(c.preferredProcessor)
    }
  }

  const options = optionsQ.data ?? []
  const brands = brandsQ.data ?? []
  const optById = new Map<string, MerchantAccountOption>(options.map((o) => [o.id, o]))
  const available = options.filter((o) => !slots.includes(o.id))

  if (venueQ.isError) {
    return (
      <Shell venueId={venueId}>
        <QueryError
          className="mt-5"
          error={venueQ.error}
          context="cargar el venue"
          onRetry={() => venueQ.refetch()}
          isRetrying={venueQ.isFetching}
        />
      </Shell>
    )
  }

  function move(i: number, dir: -1 | 1) {
    setSlots((s) => {
      const j = i + dir
      if (j < 0 || j >= s.length) return s
      const next = [...s]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function changeAt(i: number, id: string) {
    setSlots((s) => s.map((v, idx) => (idx === i ? id : v)))
  }
  function removeAt(i: number) {
    setSlots((s) => s.filter((_, idx) => idx !== i))
  }
  function addSlot(id: string) {
    if (!id) return
    setSlots((s) => (s.length < MAX_SLOTS && !s.includes(id) ? [...s, id] : s))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (slots.length === 0 || !slots[0]) {
      setFormError('Asigna al menos la cuenta principal.')
      return
    }
    setFormError(null)
    save.mutate(
      {
        exists: !!configQ.data,
        input: {
          primaryAccountId: slots[0],
          secondaryAccountId: slots[1] ?? null,
          tertiaryAccountId: slots[2] ?? null,
          preferredProcessor: processor,
          routingRules: configQ.data?.routingRules,
        },
      },
      {
        onSuccess: () => {
          toast.success('Slots de pago guardados')
          navigate(`/venues/${venueId}`)
        },
        onError: (err) => {
          const info = inspectApiError(err, 'guardar los slots')
          setFormError(info.description)
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  const venue = venueQ.data

  return (
    <Shell venueId={venueId}>
      <header className="mt-5">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          Slots de pago
        </h1>
        {venue && (
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            de <span className="font-semibold text-[var(--ink)]">{venue.name}</span>
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="mt-8 flex max-w-[600px] flex-col gap-6">
        <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">
          Las terminales del venue rutean los cobros en este orden: primero la{' '}
          <span className="text-[var(--ink)]">Principal</span>; si no aplica, la Secundaria y luego
          la Terciaria. Cambia el orden o asigna otra cuenta para liberar una terminal de una cuenta
          específica.
        </p>

        {optionsQ.isLoading ? (
          <p className="text-[13px] text-[var(--ink-faint)]">Cargando cuentas…</p>
        ) : slots.length === 0 ? (
          <p className="rounded-[8px] border border-dashed border-[var(--line-strong)] px-4 py-6 text-center text-[13px] text-[var(--ink-faint)]">
            Sin cuentas asignadas. Agrega la cuenta principal abajo para que el venue pueda cobrar.
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {slots.map((id, i) => {
              const opt = optById.get(id)
              const compatible = opt ? isProviderCompatible(opt.providerCode, brands) : true
              const rowOptions = options
                .filter((o) => o.id === id || !slots.includes(o.id))
                .map((o) => ({
                  value: o.id,
                  label: o.label,
                  description: `${o.providerName}${o.environment ? ' · ' + o.environment : ''}`,
                }))
              return (
                <li
                  key={id}
                  className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--canvas-raised)] text-[11px] font-semibold tabular-nums text-[var(--ink-muted)]">
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--ink)]">
                        {SLOT_LABELS[i] ?? `Slot ${i + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton
                        size="sm"
                        aria-label={`Subir ${SLOT_LABELS[i] ?? ''}`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </IconButton>
                      <IconButton
                        size="sm"
                        aria-label={`Bajar ${SLOT_LABELS[i] ?? ''}`}
                        disabled={i === slots.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </IconButton>
                      <IconButton
                        size="sm"
                        aria-label={`Quitar ${SLOT_LABELS[i] ?? ''}`}
                        onClick={() => removeAt(i)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                  <Combobox
                    value={id}
                    onChange={(v) => changeAt(i, v)}
                    options={rowOptions}
                    ariaLabel={`Cuenta ${SLOT_LABELS[i] ?? i + 1}`}
                    placeholder="Elige una cuenta"
                  />
                  {opt && (
                    <p
                      className={`mt-1.5 inline-flex items-center gap-1 text-[11.5px] ${
                        compatible ? 'text-[var(--ink-faint)]' : 'text-[var(--danger)]'
                      }`}
                    >
                      {compatible ? (
                        <Check className="h-3 w-3" aria-hidden />
                      ) : (
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                      )}
                      {opt.providerName}
                      {!compatible ? ' — el venue no tiene terminal compatible' : ''}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        {slots.length < MAX_SLOTS && available.length > 0 && (
          <div>
            <span className="mb-1 flex items-center gap-1 text-[12px] font-medium text-[var(--ink-muted)]">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {slots.length === 0 ? 'Asignar cuenta principal' : 'Agregar otra cuenta'}
            </span>
            <Combobox
              value=""
              onChange={addSlot}
              options={available.map((o) => ({
                value: o.id,
                label: o.label,
                description: `${o.providerName}${o.environment ? ' · ' + o.environment : ''}`,
              }))}
              ariaLabel="Agregar cuenta a un slot"
              placeholder="Elige una cuenta para agregar"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">
            Procesador preferido
          </label>
          <div className="max-w-[240px]">
            <Combobox
              value={processor}
              onChange={(v) => setProcessor(v as PreferredProcessor)}
              options={PROCESSORS.map((p) => ({ value: p, label: p }))}
              ariaLabel="Procesador preferido"
            />
          </div>
        </div>

        {formError && (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {formError}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Link
            to={`/venues/${venueId}`}
            className={buttonVariants({ variant: 'secondary', size: 'md' })}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </Shell>
  )
}

function Shell({ venueId, children }: { venueId?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-6">
      <Link
        to={`/venues/${venueId ?? ''}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Volver al venue
      </Link>
      {children}
    </div>
  )
}
