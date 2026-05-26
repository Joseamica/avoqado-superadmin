import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Globe,
  Hammer,
  Landmark,
  Loader2,
  Power,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Combobox } from '@/shared/ui/Combobox'
import { QueryError } from '@/shared/components/QueryError'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useCreatePaymentProvider,
  usePaymentProvider,
  useTogglePaymentProvider,
  useUpdatePaymentProvider,
} from './use-payment-providers'
import { ProviderDeleteDialog } from './ProviderDeleteDialog'
import {
  COUNTRY_OPTIONS,
  humanizeProviderType,
  inferTemplateFromCode,
  PROVIDER_TEMPLATES,
  PROVIDER_TYPE_TONE,
  type PaymentProvider,
  type ProviderTemplate,
  type ProviderType,
} from './types'

/**
 * Form unificado de creación y edición de payment providers. Una misma
 * página sirve para `/payment-providers/new` y `/payment-providers/:id`
 * — el modo se infiere por la presencia del `id` en useParams.
 *
 * En modo create: arriba aparece un picker de templates (Blumon, AngelPay,
 * Menta, Stripe, Custom) que pre-fill todos los campos del form. Esto le
 * da al operador el "wizard del 80% común" sin negarle el escape hatch
 * para crear providers nuevos arbitrarios.
 *
 * En modo edit: los templates NO se muestran (el provider ya existe con
 * su code inmutable). Pero sí inferimos su template del `code` para
 * mostrar un ícono / hint contextual en el header.
 *
 * Para acciones administrativas (toggle active, delete) hay sus botones
 * en una sección separada al final. Delete requiere typed-confirm con el
 * code del provider para evitar accidentes.
 */
export function PaymentProviderFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id

  const detailQuery = usePaymentProvider(id)
  const createMutation = useCreatePaymentProvider()
  const updateMutation = useUpdatePaymentProvider()
  const toggleMutation = useTogglePaymentProvider()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'PAYMENT_PROCESSOR' as ProviderType,
    countryCode: ['MX'] as string[],
    active: true,
    configSchemaText: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cuando llega el provider del backend (modo edit), hidratar el form
  // con sus valores actuales. Solo corre una vez por id — si el operador
  // ya tocó el form, no sobreescribimos.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!isEdit || !detailQuery.data || hydrated) return
    setHydrated(true)
    const p = detailQuery.data
    setForm({
      code: p.code,
      name: p.name,
      type: p.type,
      countryCode: p.countryCode,
      active: p.active,
      configSchemaText: p.configSchema ? JSON.stringify(p.configSchema, null, 2) : '',
    })
  }, [isEdit, detailQuery.data, hydrated])

  const inferredTemplate = useMemo(
    () => (isEdit ? inferTemplateFromCode(form.code) : null),
    [isEdit, form.code],
  )

  function applyTemplate(template: ProviderTemplate) {
    setSelectedTemplate(template.key)
    setForm({
      code: template.defaults.code,
      name: template.defaults.name,
      type: template.defaults.type,
      countryCode: template.defaults.countryCode,
      active: true,
      configSchemaText: template.defaults.configSchema
        ? JSON.stringify(template.defaults.configSchema, null, 2)
        : '',
    })
    setErrors({})
  }

  function validate(): { ok: true; parsed: Record<string, unknown> | null } | { ok: false } {
    const next: Record<string, string> = {}
    if (!form.code.trim()) next.code = 'El code es requerido'
    else if (!/^[A-Z0-9_]+$/.test(form.code.trim()))
      next.code = 'Solo MAYÚSCULAS, números y guión bajo (ej. STRIPE_CONNECT)'
    if (!form.name.trim()) next.name = 'El nombre es requerido'
    if (form.countryCode.length === 0) next.countryCode = 'Al menos un país requerido'

    let parsed: Record<string, unknown> | null = null
    if (form.configSchemaText.trim()) {
      try {
        const obj = JSON.parse(form.configSchemaText)
        if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) {
          next.configSchema = 'Debe ser un objeto JSON (ej. {"required":[],"properties":{}})'
        } else {
          parsed = obj as Record<string, unknown>
        }
      } catch {
        next.configSchema = 'JSON inválido — revisa la sintaxis'
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return { ok: false }
    return { ok: true, parsed }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validation = validate()
    if (!validation.ok) {
      document.querySelector('[data-field-error="true"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: id!,
          payload: {
            name: form.name.trim(),
            type: form.type,
            countryCode: form.countryCode,
            configSchema: validation.parsed,
            active: form.active,
          },
        })
        toast.success('Provider actualizado', { description: form.name })
      } else {
        const created = await createMutation.mutateAsync({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          type: form.type,
          countryCode: form.countryCode,
          configSchema: validation.parsed,
          active: form.active,
        })
        toast.success('Provider creado', { description: created.name })
        navigate(`/payment-providers/${created.id}`)
      }
    } catch (error) {
      const info = inspectApiError(error, `guardar el provider`)
      toast.error(info.title, { description: info.description })
    }
  }

  async function handleToggle() {
    if (!id) return
    try {
      const updated = await toggleMutation.mutateAsync(id)
      setForm((f) => ({ ...f, active: updated.active }))
      toast.success(`${updated.name} ${updated.active ? 'activado' : 'desactivado'}`)
    } catch (e) {
      const info = inspectApiError(e, 'cambiar estado del provider')
      toast.error(info.title, { description: info.description })
    }
  }

  if (isEdit && detailQuery.isError) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <BackLink />
        <QueryError
          className="mt-5"
          error={detailQuery.error}
          context="cargar el provider"
          onRetry={() => detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </div>
    )
  }

  if (isEdit && !detailQuery.isLoading && detailQuery.data === null) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-10">
        <BackLink />
        <div className="mt-6 rounded-[8px] border border-[var(--line)] bg-[var(--canvas-sunken)] p-6">
          <p className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
            Provider no encontrado
          </p>
          <p className="mt-2 text-[13px] text-[var(--ink-muted)]">
            El ID <code className="font-mono text-[12px] text-[var(--ink)]">{id}</code> no
            corresponde a ningún payment provider accesible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[840px] px-4 py-8 sm:px-6 md:px-8 lg:py-10">
      <BackLink />

      <Header
        isEdit={isEdit}
        provider={detailQuery.data ?? null}
        inferredTemplate={inferredTemplate ?? null}
      />

      {!isEdit && !selectedTemplate && <TemplatePicker onSelect={applyTemplate} />}

      {(isEdit || selectedTemplate) && (
        <form onSubmit={handleSubmit} className="mt-8 space-y-8" noValidate>
          {!isEdit && selectedTemplate && (
            <div className="flex items-center justify-between rounded-[6px] border border-[var(--accent-line)] bg-[var(--accent-faint)] px-3 py-2 text-[12px]">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                <span className="text-[var(--ink)]">
                  Empezaste desde el template{' '}
                  <span className="font-semibold">
                    {PROVIDER_TEMPLATES.find((t) => t.key === selectedTemplate)?.label}
                  </span>
                  . Edita los campos como necesites.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate(null)
                  setForm({
                    code: '',
                    name: '',
                    type: 'PAYMENT_PROCESSOR',
                    countryCode: ['MX'],
                    active: true,
                    configSchemaText: '',
                  })
                  setErrors({})
                }}
                className="text-[11.5px] font-medium text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
              >
                Cambiar template
              </button>
            </div>
          )}

          <Section title="Identidad">
            <FormField
              id="provider-code"
              label="Code"
              required
              hint={
                isEdit
                  ? 'No se puede cambiar después de crear (otros sistemas referencian este code).'
                  : 'Identificador único, MAYÚSCULAS y guión bajo (ej. BLUMON, STRIPE_CONNECT).'
              }
              error={errors.code}
            >
              <input
                id="provider-code"
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="BLUMON"
                disabled={isEdit}
                className={cn(
                  inputClass(!!errors.code),
                  'font-mono uppercase',
                  isEdit && 'cursor-not-allowed opacity-60',
                )}
                data-field-error={!!errors.code}
              />
            </FormField>

            <FormField id="provider-name" label="Nombre" required error={errors.name}>
              <input
                id="provider-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Blumon PAX Payment Solutions"
                className={inputClass(!!errors.name)}
                data-field-error={!!errors.name}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="provider-type" label="Tipo" required>
                <Combobox
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v as ProviderType }))}
                  options={[
                    {
                      value: 'PAYMENT_PROCESSOR',
                      label: 'Procesador de pagos',
                      description: 'Blumon, AngelPay, Stripe, etc.',
                    },
                    { value: 'GATEWAY', label: 'Gateway', description: 'Menta, Stripe Connect' },
                    { value: 'BANK_DIRECT', label: 'Banco directo', description: 'BANORTE_DIRECT' },
                    { value: 'WALLET', label: 'Wallet', description: 'Clip, PayPal' },
                    { value: 'OTHER', label: 'Otro' },
                  ]}
                  placeholder="Selecciona tipo"
                  searchPlaceholder="Buscar tipo…"
                  renderTriggerValue={(v) => humanizeProviderType(v as ProviderType)}
                />
              </FormField>

              <FormField id="provider-active" label="Estado">
                <button
                  type="button"
                  id="provider-active"
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  className={cn(
                    'inline-flex h-10 w-full items-center justify-between rounded-[6px] border px-3 text-[13px] transition-colors',
                    form.active
                      ? 'border-[var(--success)]/30 bg-[var(--success-faint)] text-[var(--success)]'
                      : 'border-[var(--line-strong)] bg-[var(--canvas)] text-[var(--ink-muted)]',
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        form.active
                          ? 'bg-[var(--success)] shadow-[0_0_0_3px_var(--success-faint)]'
                          : 'bg-[var(--ink-faint)] shadow-[0_0_0_3px_var(--line)]',
                      )}
                    />
                    <span className="font-medium">{form.active ? 'Activo' : 'Inactivo'}</span>
                  </span>
                  <span className="text-[10.5px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
                    Toggle
                  </span>
                </button>
              </FormField>
            </div>

            <FormField
              id="provider-countries"
              label="Países"
              required
              hint="Países donde opera este provider (ISO-2). Avoqado es B2B MX-first."
              error={errors.countryCode}
            >
              <CountriesPicker
                selected={form.countryCode}
                onChange={(next) => setForm((f) => ({ ...f, countryCode: next }))}
              />
            </FormField>
          </Section>

          <ConfigSchemaSection
            value={form.configSchemaText}
            onChange={(v) => setForm((f) => ({ ...f, configSchemaText: v }))}
            error={errors.configSchema}
            inferredTemplate={inferredTemplate ?? null}
          />

          {isEdit && (
            <AdminSection
              provider={detailQuery.data!}
              isToggling={toggleMutation.isPending}
              onToggle={handleToggle}
              onDelete={() => setDeleteOpen(true)}
            />
          )}

          {isEdit && detailQuery.data && (
            <ProviderDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              providerId={id!}
              providerName={detailQuery.data.name}
              onDeleted={() => {
                setDeleteOpen(false)
                navigate('/payment-providers')
              }}
            />
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
            <Link
              to="/payment-providers"
              className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[13px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className={buttonVariants({ size: 'lg', className: 'gap-2 px-5' })}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {isEdit ? 'Guardar cambios' : 'Crear provider'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/* ─── Header ──────────────────────────────────────────────────── */

function BackLink() {
  return (
    <Link
      to="/payment-providers"
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Payment providers
    </Link>
  )
}

function Header({
  isEdit,
  provider,
  inferredTemplate,
}: {
  isEdit: boolean
  provider: PaymentProvider | null
  inferredTemplate: ProviderTemplate | null
}) {
  return (
    <header className="mt-4">
      <p className="eyebrow">Configuración · Payment provider</p>
      <div className="mt-1.5 flex items-center gap-3">
        <h1 className="break-words font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          {isEdit && provider ? provider.name : isEdit ? 'Editar provider' : 'Nuevo provider'}
        </h1>
        {isEdit && provider && (
          <Badge tone={provider.active ? 'success' : 'muted'}>
            {provider.active ? 'Activo' : 'Inactivo'}
          </Badge>
        )}
      </div>
      {isEdit && provider && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-[var(--ink-muted)]">
          <code className="font-mono text-[12px] text-[var(--ink)]">{provider.code}</code>
          <span className="text-[var(--ink-faint)]">·</span>
          <Badge tone={PROVIDER_TYPE_TONE[provider.type]}>
            {humanizeProviderType(provider.type)}
          </Badge>
          {inferredTemplate && inferredTemplate.key !== 'custom' && (
            <>
              <span className="text-[var(--ink-faint)]">·</span>
              <span className="inline-flex items-center gap-1 text-[var(--ink-faint)]">
                <Sparkles className="h-3 w-3" aria-hidden />
                template <span className="font-semibold">{inferredTemplate.label}</span>
              </span>
            </>
          )}
        </div>
      )}
    </header>
  )
}

/* ─── Templates picker ──────────────────────────────────────── */

const TEMPLATE_ICONS: Record<string, typeof CreditCard> = {
  blumon: CreditCard,
  angelpay: Wallet,
  menta: Globe,
  stripe: Landmark,
  custom: Hammer,
}

function TemplatePicker({ onSelect }: { onSelect: (t: ProviderTemplate) => void }) {
  return (
    <section className="mt-8">
      <header className="mb-4">
        <p className="eyebrow">Empezar desde template</p>
        <h2 className="mt-1 font-display text-[16px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
          ¿Qué provider vas a configurar?
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--ink-muted)]">
          Los templates pre-fill code, nombre, tipo, países y configSchema con valores reales del
          seed. Después podés editar lo que necesites.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROVIDER_TEMPLATES.map((template) => {
          const Icon = TEMPLATE_ICONS[template.key] ?? Hammer
          return (
            <li key={template.key}>
              <button
                type="button"
                onClick={() => onSelect(template)}
                className="group flex w-full items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-4 text-left transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--accent-faint)]/40"
              >
                <div
                  className={cn(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
                    template.key === 'custom'
                      ? 'border-[var(--line)] bg-[var(--canvas-sunken)] text-[var(--ink-muted)]'
                      : 'border-[var(--accent-line)] bg-[var(--accent-faint)] text-[var(--accent)]',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
                      {template.label}
                    </p>
                    {template.defaults.code && (
                      <code className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-[var(--ink-faint)]">
                        {template.defaults.code}
                      </code>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-muted)]">
                    {template.description}
                  </p>
                </div>
                <ChevronRight
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)] group-hover:text-[var(--accent)]"
                  aria-hidden
                />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ─── Reusable form atoms ───────────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--line)] pt-6">
      <h2 className="mb-5 font-display text-[18px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
        {title}
      </h2>
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

function inputClass(hasError: boolean): string {
  return cn(
    'h-10 w-full rounded-[6px] border bg-[var(--canvas)] px-3 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)]',
    hasError
      ? 'border-[var(--danger)] focus:border-[var(--danger)]'
      : 'border-[var(--line-strong)] focus:border-[var(--accent-line)]',
  )
}

/* ─── Countries picker (multi-checkbox compacto) ───────────── */

function CountriesPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const set = new Set(selected)
  const toggle = (code: string) => {
    const next = new Set(set)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange([...next])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {COUNTRY_OPTIONS.map((c) => {
        const isActive = set.has(c.code)
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => toggle(c.code)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2.5 text-[12px] font-medium transition-colors',
              isActive
                ? 'border-[var(--accent-line)] bg-[var(--accent-faint)] text-[var(--accent)]'
                : 'border-[var(--line-strong)] bg-[var(--canvas)] text-[var(--ink-muted)] hover:text-[var(--ink)]',
            )}
          >
            <span className="font-mono">{c.code}</span>
            <span className="text-[10.5px] opacity-70">{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── configSchema editor (collapsible) ────────────────────── */

function ConfigSchemaSection({
  value,
  onChange,
  error,
  inferredTemplate,
}: {
  value: string
  onChange: (next: string) => void
  error?: string
  inferredTemplate: ProviderTemplate | null
}) {
  const [expanded, setExpanded] = useState(false)

  const hasContent = !!value.trim()
  // Auto-expand cuando hay contenido o error — el operador necesita verlo.
  const isOpen = expanded || hasContent || !!error

  function format() {
    try {
      const obj = JSON.parse(value)
      onChange(JSON.stringify(obj, null, 2))
      toast.success('JSON formateado')
    } catch {
      toast.error('JSON inválido — no se puede formatear')
    }
  }

  function loadFromTemplate() {
    if (!inferredTemplate || !inferredTemplate.defaults.configSchema) return
    onChange(JSON.stringify(inferredTemplate.defaults.configSchema, null, 2))
  }

  return (
    <section className="border-t border-[var(--line)] pt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.015em] text-[var(--ink)]">
            Config schema (avanzado)
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--ink-muted)]">
            JSON schema que describe qué campos debe llenar cada merchant account asignado a este
            provider (apiKey, serialNumber, etc.). Lo lee el form de creación de merchants. Opcional
            — déjalo vacío y los merchants podrán configurarse libre.
          </p>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform',
            !isOpen && '-rotate-90',
          )}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={format}
              disabled={!hasContent}
              className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[11.5px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              Formatear JSON
            </button>
            {inferredTemplate && inferredTemplate.defaults.configSchema && (
              <button
                type="button"
                onClick={loadFromTemplate}
                className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-[var(--accent-line)] bg-[var(--accent-faint)] px-3 text-[11.5px] font-medium text-[var(--accent)] hover:bg-[var(--accent-faint)]/80"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Cargar schema de {inferredTemplate.label}
              </button>
            )}
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{ "required": [], "properties": {} }'
            rows={12}
            className={cn(
              'tabular w-full rounded-[6px] border bg-[var(--canvas)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)]',
              error
                ? 'border-[var(--danger)] focus:border-[var(--danger)]'
                : 'border-[var(--line-strong)] focus:border-[var(--accent-line)]',
            )}
            spellCheck={false}
            data-field-error={!!error}
          />
          {error && <p className="text-[11.5px] text-[var(--danger)]">{error}</p>}
          <p className="text-[11px] text-[var(--ink-faint)]">
            Shape esperado:{' '}
            <code className="font-mono">
              {`{ required: string[], properties: { fieldName: { type, description } } }`}
            </code>
          </p>
        </div>
      )}
    </section>
  )
}

/* ─── Admin section (toggle + delete) ───────────────────────── */

function AdminSection({
  provider,
  isToggling,
  onToggle,
  onDelete,
}: {
  provider: PaymentProvider
  isToggling: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <section className="rounded-[8px] border border-[var(--danger)]/30 bg-[var(--danger-faint)]/30 p-5">
      <h2 className="font-display text-[15px] font-semibold text-[var(--danger)]">
        Acciones administrativas
      </h2>
      <p className="mt-1 text-[11.5px] text-[var(--ink-muted)]">
        Desactivar afecta solo la disponibilidad para nuevos merchants. Borrar abre un flujo guiado
        que primero te deja quitar lo que use el provider.
      </p>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={isToggling}
          className="flex w-full items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-3 text-left transition-colors hover:bg-[var(--canvas-sunken)] disabled:opacity-60"
        >
          <Power
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              provider.active ? 'text-[var(--warn)]' : 'text-[var(--success)]',
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              {provider.active ? 'Desactivar provider' : 'Activar provider'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
              {provider.active
                ? 'Bloquea creación de merchants nuevos. Los merchants existentes siguen operando.'
                : 'Vuelve a estar disponible para asignar a merchants nuevas.'}
            </p>
          </div>
          {isToggling && <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="flex w-full items-start gap-3 rounded-[6px] border border-[var(--line)] bg-[var(--canvas)] p-3 text-left transition-colors hover:border-[var(--danger)]/40 hover:bg-[var(--danger-faint)]/40"
        >
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--ink)]">Borrar provider…</p>
            <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
              {(provider.merchantsCount ?? 0) > 0
                ? `${provider.merchantsCount} merchant(s) lo usan. El flujo guiado te deja quitarlos antes de borrar.`
                : 'Abre el flujo guiado: revisa dependencias y borra de forma permanente cuando esté limpio.'}
            </p>
          </div>
        </button>
      </div>
    </section>
  )
}
