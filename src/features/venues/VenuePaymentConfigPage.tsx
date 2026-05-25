import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Combobox } from '@/shared/ui/Combobox'
import { Button } from '@/shared/ui/Button'
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

export function VenuePaymentConfigPage() {
  const { venueId } = useParams<{ venueId: string }>()
  const navigate = useNavigate()

  const venueQ = useVenueDetail(venueId)
  const configQ = useVenuePaymentConfig(venueId)
  const optionsQ = useMerchantAccountOptions()
  const brandsQ = useVenueTerminalBrands(venueId)
  const save = useSaveVenuePaymentConfig(venueId ?? '')

  const [primary, setPrimary] = useState('')
  const [secondary, setSecondary] = useState('')
  const [tertiary, setTertiary] = useState('')
  const [processor, setProcessor] = useState<PreferredProcessor>('AUTO')
  const [formError, setFormError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // One-shot hydration: populate form from loaded config. We use a state flag
  // instead of useEffect to avoid derived-state anti-pattern (CLAUDE.md).
  if (!hydrated && configQ.isSuccess) {
    setHydrated(true)
    const c = configQ.data
    if (c) {
      setPrimary(c.primaryAccountId)
      setSecondary(c.secondaryAccountId ?? '')
      setTertiary(c.tertiaryAccountId ?? '')
      setProcessor(c.preferredProcessor)
    }
  }

  const options = optionsQ.data ?? []
  const brands = brandsQ.data ?? []
  const optById = new Map<string, MerchantAccountOption>(options.map((o) => [o.id, o]))

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

  function validate(): string | null {
    if (!primary) return 'Elige la cuenta principal.'
    if (secondary && secondary === primary)
      return 'La secundaria no puede ser igual a la principal.'
    if (tertiary && (tertiary === primary || tertiary === secondary))
      return 'La terciaria no puede repetir otra cuenta.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) {
      setFormError(v)
      return
    }
    setFormError(null)
    save.mutate(
      {
        exists: !!configQ.data,
        input: {
          primaryAccountId: primary,
          secondaryAccountId: secondary || null,
          tertiaryAccountId: tertiary || null,
          preferredProcessor: processor,
          routingRules: configQ.data?.routingRules,
        },
      },
      {
        onSuccess: () => {
          toast.success('Configuración de pago guardada')
          navigate(`/venues/${venueId}`)
        },
        onError: (err) => {
          const info = inspectApiError(err, 'guardar la configuración')
          setFormError(info.description)
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  const venue = venueQ.data

  const accountOptions = options.map((o) => ({
    value: o.id,
    label: o.label,
    description: `${o.providerName}${o.environment ? ' · ' + o.environment : ''}`,
  }))

  const optionalOptions = [{ value: '', label: '— ninguno —' }, ...accountOptions]

  return (
    <Shell venueId={venueId}>
      <header className="mt-5">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          Configurar pagos
        </h1>
        {venue && (
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            para <span className="font-semibold text-[var(--ink)]">{venue.name}</span>
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="mt-8 flex max-w-[560px] flex-col gap-6">
        <Slot
          label="Cuenta principal"
          required
          value={primary}
          onChange={setPrimary}
          options={accountOptions}
          opt={optById.get(primary)}
          brands={brands}
        />
        <Slot
          label="Cuenta secundaria"
          value={secondary}
          onChange={setSecondary}
          options={optionalOptions}
          opt={optById.get(secondary)}
          brands={brands}
        />
        <Slot
          label="Cuenta terciaria"
          value={tertiary}
          onChange={setTertiary}
          options={optionalOptions}
          opt={optById.get(tertiary)}
          brands={brands}
        />

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

interface SlotProps {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; description?: string }[]
  opt?: MerchantAccountOption
  brands: string[]
}

function Slot({ label, required, value, onChange, options, opt, brands }: SlotProps) {
  const compatible = opt ? isProviderCompatible(opt.providerCode, brands) : true

  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-[var(--ink-muted)]">
        {label}
        {required ? ' *' : ''}
      </label>
      <Combobox
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel={label}
        placeholder="Elige una cuenta"
      />
      {opt && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-[11.5px] ${
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
    </div>
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
