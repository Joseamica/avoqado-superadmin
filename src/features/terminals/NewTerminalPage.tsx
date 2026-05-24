import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Copy, KeyRound, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { formatDateTime } from '@/shared/lib/datetime'
import { useVenues } from '@/features/venues/use-venues'
import { useCreateTerminal, useMerchantAccounts, useRemoteActivate } from './use-terminals'
import { humanizeTerminalType, type TerminalType } from './types'
import type { MerchantAccountOption } from './api'

/**
 * Alta de terminal — equivalente al `NewVenuePage` para TPVs.
 *
 * Patrón industrial: una sola página, secciones progresivamente reveladas,
 * defaults razonables. Después de crear:
 *   - Si se pidió código de activación: lo muestra arriba con copy button
 *     antes de redirigir (el operador lo necesita para llevárselo al técnico).
 *   - Si NO se pidió código: navega directo al `/terminals` con toast.
 *
 * Pre-fill desde el icono de Setup en `/venues`: si llega `?venueId=X` por
 * query param, el dropdown de venue queda pre-seleccionado e inmutable
 * (el operador eligió desde la pantalla de venue, no tiene sentido cambiarlo
 * aquí).
 */

type TerminalTypeOption = TerminalType

const TYPE_OPTIONS: ComboboxOption[] = [
  {
    value: 'TPV_ANDROID',
    label: 'TPV Android',
    description: 'PAX A910s / Verifone / Ingenico',
    searchTokens: 'tpv android pax verifone ingenico nexgo',
  },
  {
    value: 'TPV_IOS',
    label: 'TPV iOS',
    description: 'iPad / iPhone con AvoqadoPOS',
    searchTokens: 'tpv ios ipad iphone',
  },
  {
    value: 'PRINTER_RECEIPT',
    label: 'Impresora de tickets',
    description: 'Star Micronics, Epson, etc.',
    searchTokens: 'impresora ticket recibo',
  },
  {
    value: 'PRINTER_KITCHEN',
    label: 'Impresora de cocina',
    description: 'Impresora térmica para órdenes',
    searchTokens: 'impresora cocina kitchen',
  },
  {
    value: 'KDS',
    label: 'KDS',
    description: 'Kitchen Display System',
    searchTokens: 'kds kitchen display',
  },
]

/**
 * Modo de activación al crear. 3 caminos según el escenario del operador:
 *
 *   `pending`       Registra la terminal en `PENDING_ACTIVATION` sin código.
 *                   La activamos después (drawer → "Generar código" o
 *                   "Activar remotamente"). Útil para roll-outs en lote.
 *
 *   `with-code`     Registra + genera código 6-char. El técnico en sitio
 *                   lo escribe en la pantalla de bootstrap. Default.
 *
 *   `activate-now`  Registra + dispara `remote-activate` inmediatamente.
 *                   La terminal queda lista para operar sin código —
 *                   úsalo cuando el hardware ya está físicamente prendido
 *                   y conectado en el venue.
 */
type ActivationMode = 'pending' | 'with-code' | 'activate-now'

interface FormState {
  venueId: string
  name: string
  serialNumber: string
  type: TerminalTypeOption
  brand: string
  model: string
  merchantIds: Set<string>
  activationMode: ActivationMode
}

const INITIAL_STATE: FormState = {
  venueId: '',
  name: '',
  serialNumber: '',
  type: 'TPV_ANDROID',
  brand: '',
  model: '',
  merchantIds: new Set(),
  activationMode: 'with-code',
}

/** Catálogo común — el operador puede escribir libre, pero estos son los más usados. */
const BRAND_OPTIONS: ComboboxOption[] = [
  { value: 'PAX', label: 'PAX', description: 'A910s, A920, etc.' },
  { value: 'NEXGO', label: 'NEXGO', description: 'N3, N5, N86' },
  { value: 'Verifone', label: 'Verifone', description: 'V200c, V240m' },
  { value: 'Ingenico', label: 'Ingenico', description: 'Lane series, Move series' },
  { value: 'Star Micronics', label: 'Star Micronics', description: 'Impresoras' },
  { value: 'Epson', label: 'Epson', description: 'Impresoras térmicas' },
  { value: 'Apple', label: 'Apple', description: 'iPad / iPhone' },
]

export function NewTerminalPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Pre-fill desde el icono de Setup en /venues. El param es opcional —
  // si el operador entra directo a /terminals/new, eligen venue en el form.
  const prefilledVenueId = searchParams.get('venueId')

  const venuesQuery = useVenues({})
  const merchantsQuery = useMerchantAccounts()
  const createMutation = useCreateTerminal()
  const remoteActivateMutation = useRemoteActivate()

  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    venueId: prefilledVenueId ?? '',
  })
  const [hardwareExpanded, setHardwareExpanded] = useState(false)
  const [merchantExpanded, setMerchantExpanded] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activationResult, setActivationResult] = useState<{
    code: string
    expiresAt: string | null
    terminalId: string
  } | null>(null)

  const venueOptions: ComboboxOption[] = useMemo(() => {
    const list = venuesQuery.data ?? []
    return list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({
        value: v.id,
        label: v.name,
        description: `${v.organization.name} · ${v.slug}`,
        searchTokens: `${v.slug} ${v.organization.name}`,
      }))
  }, [venuesQuery.data])

  const merchantOptions = useMemo(() => merchantsQuery.data ?? [], [merchantsQuery.data])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  const toggleMerchant = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.merchantIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, merchantIds: next }
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.venueId) next.venueId = 'Selecciona el venue al que pertenece'
    if (!form.name.trim() || form.name.trim().length < 1) {
      next.name = 'Nombre requerido'
    }
    if (!form.serialNumber.trim()) {
      next.serialNumber =
        'Requerido. Para terminals que aún no tienen serial físico, ingresa un placeholder único (ej. PENDING-{venue-slug}-001).'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) {
      const firstError = document.querySelector('[data-field-error="true"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    try {
      const result = await createMutation.mutateAsync({
        venueId: form.venueId,
        name: form.name.trim(),
        serialNumber: form.serialNumber.trim(),
        type: form.type,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        assignedMerchantIds: form.merchantIds.size > 0 ? [...form.merchantIds] : undefined,
        // Sólo pedimos código cuando el operador lo eligió explícitamente.
        // En `pending` y `activate-now` el backend no genera nada.
        generateActivationCode: form.activationMode === 'with-code',
      })

      // Caso 1: el operador eligió "Generar código" — mostramos success card
      // con el código grande para que pueda copiarlo antes de moverse.
      if (form.activationMode === 'with-code' && result.activationCode) {
        setActivationResult({
          code: result.activationCode,
          expiresAt: result.activationCodeExpiry,
          terminalId: result.id,
        })
        return
      }

      // Caso 2: el operador eligió "Activar ahora" — segundo POST a
      // /remote-activate para que la terminal pase a ACTIVE sin código.
      // Si remote-activate falla, el terminal igual quedó creado en
      // PENDING_ACTIVATION — informamos en el toast para que el operador
      // sepa el estado y pueda reintentar la activación desde el drawer.
      if (form.activationMode === 'activate-now') {
        try {
          await remoteActivateMutation.mutateAsync(result.id)
          toast.success('Terminal creada y activada', {
            description: `${result.name} está lista para operar en ${result.venue.name}.`,
          })
        } catch (activateError) {
          const info = inspectApiError(activateError, 'activar remotamente')
          toast.warning('Terminal creada — falló la activación', {
            description: `${info.description} Reintenta desde el drawer del terminal.`,
          })
        }
        navigate('/terminals')
        return
      }

      // Caso 3: `pending` — terminal queda registrada sin código y sin activar.
      toast.success('Terminal creada', {
        description: `${result.name} en ${result.venue.name}. Está en PENDING_ACTIVATION — activala cuando estés listo.`,
      })
      navigate('/terminals')
    } catch (error) {
      const info = inspectApiError(error, 'crear la terminal')
      toast.error(info.title, { description: info.description })
    }
  }

  // Si el create exitoso resultó en un código de activación, mostramos la
  // success card en lugar del form.
  if (activationResult) {
    return (
      <ActivationSuccessCard
        result={activationResult}
        prefilledVenueId={prefilledVenueId}
        onDone={() => navigate('/terminals')}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 md:px-8 lg:py-10">
      <Link
        to={prefilledVenueId ? `/venues/${prefilledVenueId}` : '/terminals'}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {prefilledVenueId ? 'Volver al venue' : 'Terminals'}
      </Link>

      <header className="mt-4 mb-8">
        <p className="eyebrow">Catálogo · Terminal</p>
        <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
          Registrar terminal
        </h1>
        <p className="mt-3 max-w-[540px] text-[14px] text-[var(--ink-muted)]">
          Alta de TPV, impresora o KDS. Después de crear, la terminal aparece en `INACTIVE` hasta
          que envía su primer heartbeat — si pides código de activación, lo damos al técnico para
          que la prenda.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10" noValidate>
        <Section title="Esencial">
          <FormField
            id="venue-id"
            label="Venue al que pertenece"
            required
            error={errors.venueId}
            hint={
              prefilledVenueId
                ? 'Pre-seleccionado desde el venue.'
                : 'La terminal queda vinculada — sus pagos liquidan a este venue.'
            }
          >
            <Combobox
              value={form.venueId}
              onChange={(v) => update('venueId', v)}
              options={venueOptions}
              disabled={!!prefilledVenueId || venuesQuery.isLoading}
              placeholder={venuesQuery.isLoading ? 'Cargando venues…' : 'Selecciona venue'}
              searchPlaceholder="Buscar por nombre, slug u organización…"
              emptyLabel="Sin venues que coincidan"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
            <FormField
              id="terminal-name"
              label="Nombre interno"
              required
              error={errors.name}
              hint='Ej. "TPV Barra", "TPV Caja 2", "Impresora cocina".'
            >
              <input
                id="terminal-name"
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="TPV Barra"
                className={inputClass(!!errors.name)}
                data-field-error={!!errors.name}
                autoFocus
              />
            </FormField>

            <FormField id="terminal-type" label="Tipo">
              <Combobox
                value={form.type}
                onChange={(v) => update('type', v as TerminalTypeOption)}
                options={TYPE_OPTIONS}
                placeholder="Selecciona tipo"
                searchPlaceholder="Buscar tipo…"
                renderTriggerValue={(v) => humanizeTerminalType(v as TerminalType)}
              />
            </FormField>
          </div>

          <FormField
            id="serial-number"
            label="Número de serie"
            required
            error={errors.serialNumber}
            hint="Serial físico del hardware. Si aún no lo tienes (terminal pre-comprada), usa un placeholder único."
          >
            <input
              id="serial-number"
              type="text"
              value={form.serialNumber}
              onChange={(e) => update('serialNumber', e.target.value)}
              placeholder="ej. 1850072345 o PENDING-pez-volador-001"
              className={cn(inputClass(!!errors.serialNumber), 'font-mono')}
              data-field-error={!!errors.serialNumber}
            />
          </FormField>
        </Section>

        <Section
          title="Hardware (opcional)"
          subtitle="Marca y modelo del dispositivo físico. Útil para diagnósticos y compatibilidad con providers."
          collapsed={!hardwareExpanded}
          onToggle={() => setHardwareExpanded((v) => !v)}
        >
          {hardwareExpanded && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="brand" label="Marca">
                <Combobox
                  value={form.brand}
                  onChange={(v) => update('brand', v)}
                  options={BRAND_OPTIONS}
                  placeholder="PAX, NEXGO, Apple…"
                  searchPlaceholder="Buscar marca…"
                  allowCustomValue
                />
              </FormField>
              <FormField
                id="model"
                label="Modelo"
                hint="Ej. A910s, V200c, iPad Pro 12.9, TM-m30III"
              >
                <input
                  id="model"
                  type="text"
                  value={form.model}
                  onChange={(e) => update('model', e.target.value)}
                  placeholder="A910s"
                  className={inputClass(false)}
                />
              </FormField>
            </div>
          )}
        </Section>

        <Section
          title="Merchant accounts (opcional)"
          subtitle={
            merchantsQuery.data
              ? `${form.merchantIds.size} de ${merchantsQuery.data.length} asignados. Si no asignas ninguno aquí, la terminal usará el merchant primario del venue (el de la VenuePaymentConfig).`
              : 'Cargando merchant accounts…'
          }
          collapsed={!merchantExpanded}
          onToggle={() => setMerchantExpanded((v) => !v)}
        >
          {merchantExpanded && (
            <MerchantPicker
              merchants={merchantOptions}
              loading={merchantsQuery.isLoading}
              selected={form.merchantIds}
              onToggle={toggleMerchant}
            />
          )}
        </Section>

        <Section title="Activación" subtitle="Cómo arrancará la terminal después de crearla.">
          <ActivationRadio
            value={form.activationMode}
            onChange={(v) => update('activationMode', v)}
          />
        </Section>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
          <Link
            to={prefilledVenueId ? `/venues/${prefilledVenueId}` : '/terminals'}
            className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[13px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending || remoteActivateMutation.isPending}
            className={buttonVariants({ size: 'lg', className: 'gap-2 px-5' })}
          >
            {(createMutation.isPending || remoteActivateMutation.isPending) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            )}
            {createMutation.isPending
              ? 'Creando…'
              : remoteActivateMutation.isPending
                ? 'Activando…'
                : form.activationMode === 'activate-now'
                  ? 'Crear y activar'
                  : form.activationMode === 'with-code'
                    ? 'Crear y generar código'
                    : 'Crear terminal'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  collapsed?: boolean
  onToggle?: () => void
  children: ReactNode
}) {
  const isCollapsible = onToggle !== undefined
  return (
    <section className="border-t border-[var(--line)] pt-6">
      <header className={cn('mb-5', isCollapsible && 'cursor-pointer')}>
        {isCollapsible ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start justify-between gap-4 text-left"
            aria-expanded={!collapsed}
          >
            <div className="min-w-0">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1.5 text-[12.5px] text-[var(--ink-muted)]">{subtitle}</p>
              )}
            </div>
            <ChevronDown
              className={cn(
                'mt-1 h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform',
                collapsed && '-rotate-90',
              )}
              aria-hidden
            />
          </button>
        ) : (
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
            {title}
          </h2>
        )}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium tracking-[-0.005em] text-[var(--ink)]">
        {label}
        {required && (
          <span className="ml-1 text-[var(--accent)]" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-[11.5px] text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-[11.5px] text-[var(--ink-faint)]">{hint}</p>
      ) : null}
    </div>
  )
}

function MerchantPicker({
  merchants,
  loading,
  selected,
  onToggle,
}: {
  merchants: MerchantAccountOption[]
  loading: boolean
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  if (loading) {
    return <p className="text-[12.5px] text-[var(--ink-faint)]">Cargando merchant accounts…</p>
  }
  if (merchants.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        No hay merchant accounts disponibles. Créalas primero desde la sección de Merchants
        (próximamente) o por endpoint directo.
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {merchants.map((m) => {
        const isSelected = selected.has(m.id)
        return (
          <li key={m.id}>
            <label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[6px] border p-3 transition-colors',
                isSelected
                  ? 'border-[var(--accent-line)] bg-[var(--accent-faint)]'
                  : 'border-[var(--line)] hover:bg-[var(--canvas-sunken)]',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggle(m.id)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--ink)]">{m.displayName}</p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
                  <span className="font-mono">{m.providerName}</span>
                  {m.alias && (
                    <>
                      <span className="mx-1.5 opacity-50">·</span>
                      <span>{m.alias}</span>
                    </>
                  )}
                  {m.externalMerchantId && (
                    <>
                      <span className="mx-1.5 opacity-50">·</span>
                      <span className="font-mono">{m.externalMerchantId}</span>
                    </>
                  )}
                </p>
              </div>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function ActivationSuccessCard({
  result,
  onDone,
}: {
  result: { code: string; expiresAt: string | null; terminalId: string }
  prefilledVenueId: string | null
  onDone: () => void
}) {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-line)] bg-[var(--accent-faint)]">
          <Smartphone className="h-5 w-5 text-[var(--accent)]" aria-hidden />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge tone="success">Terminal creada</Badge>
          <Badge tone="accent">Código generado</Badge>
        </div>
        <h1 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] sm:text-[28px]">
          Da este código al técnico
        </h1>
        <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
          La terminal se activará la primera vez que el técnico lo ingrese en la pantalla de
          bootstrap. Caduca a los 7 días.
        </p>
      </header>

      <section className="rounded-[8px] border-2 border-[var(--accent-line)] bg-[var(--accent-faint)] p-8 text-center">
        <p className="text-[10.5px] font-medium text-[var(--accent)]/70">Código de activación</p>
        <p className="tabular mt-3 font-mono text-[44px] font-bold tracking-[0.18em] text-[var(--ink)]">
          {result.code}
        </p>
        {result.expiresAt && (
          <p className="tabular mt-4 text-[11.5px] text-[var(--ink-muted)]">
            Expira {formatDateTime(result.expiresAt)}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(result.code)
              toast.success('Código copiado')
            }
          }}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[var(--accent-line)] bg-[var(--canvas)] px-4 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--canvas-sunken)]"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copiar código
        </button>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          to={`/terminals`}
          onClick={onDone}
          className={buttonVariants({ size: 'lg', className: 'px-5' })}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Ir a la lista de terminals
        </Link>
      </div>

      <p className="mt-6 text-center text-[11px] text-[var(--ink-faint)]">
        Terminal ID: <code className="font-mono">{result.terminalId}</code> · Si pierdes este
        código, puedes regenerarlo desde el drawer de la terminal.
      </p>
    </div>
  )
}

/**
 * Radio group de modo de activación. Tres opciones con descripción larga;
 * la activa se pinta accent + check, las inactivas se quedan muted. UX
 * pattern: cards verticales con click en todo el card (no sólo el dot del
 * radio), similar al patrón "billing plan picker" de Stripe / Linear.
 */
function ActivationRadio({
  value,
  onChange,
}: {
  value: ActivationMode
  onChange: (next: ActivationMode) => void
}) {
  const OPTIONS: Array<{
    value: ActivationMode
    label: string
    description: string
    tag?: string
  }> = [
    {
      value: 'with-code',
      label: 'Generar código para técnico',
      description:
        'Devuelve un código 6-char alfanumérico (ej. A3F9K2). El técnico en sitio lo escribe en la pantalla de bootstrap. Caduca a 7 días. Recomendado cuando NO eres tú quien prende físicamente la terminal.',
      tag: 'Recomendado',
    },
    {
      value: 'activate-now',
      label: 'Activar ahora — sin código',
      description:
        'La terminal queda ACTIVE inmediatamente. Úsalo cuando el hardware ya está físicamente prendido y conectado en el venue, y NO quieres pasar por el flujo de código. Dispara create + remote-activate en una sola operación.',
      tag: 'Sin código',
    },
    {
      value: 'pending',
      label: 'Pendiente — registrar sin activar',
      description:
        'Sólo registra la terminal en PENDING_ACTIVATION. Sin código, sin activación. Después la activas desde el drawer del terminal cuando estés listo. Útil para roll-outs en lote donde primero das de alta todo y activas en bloque después.',
    },
  ]

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Modo de activación">
      {OPTIONS.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex w-full items-start gap-3 rounded-[6px] border p-3.5 text-left transition-colors',
              isActive
                ? 'border-[var(--accent-line)] bg-[var(--accent-faint)]'
                : 'border-[var(--line)] hover:bg-[var(--canvas-sunken)]',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : 'border-[var(--line-strong)]',
              )}
            >
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--canvas)]" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[var(--ink)]">{option.label}</p>
                {option.tag && (
                  <Badge size="sm" tone={isActive ? 'accent' : 'muted'}>
                    {option.tag}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-[var(--ink-muted)]">
                {option.description}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function inputClass(hasError: boolean): string {
  return cn(
    'h-10 w-full rounded-[6px] border bg-[var(--canvas)] px-3 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)]',
    hasError
      ? 'border-[var(--danger)] focus:border-[var(--danger)]'
      : 'border-[var(--line-strong)] focus:border-[var(--accent-line)]',
  )
}
