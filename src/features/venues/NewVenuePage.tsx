import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import { useCreateVenue, useFeatures, useOrganizations } from './use-venues'
import { failedWizardSteps } from './api'
import type {
  CreateVenuePayload,
  EntityType,
  OrganizationOption,
  PlatformFeature,
  VenueType,
} from './api'

/**
 * Página dedicada para crear un venue. Patrón industrial (Stripe Atlas,
 * Mercury, Linear): UN solo screen con secciones progresivamente
 * reveladas, NO wizard de N pasos. Defaults razonables para todo lo
 * opcional. Después de crear, lands en el detail para refinar.
 *
 * El backend acepta el payload completo en una sola request al endpoint
 * `POST /api/v1/superadmin/onboarding/venue`. Si el operador marcó
 * "Pre-aprobar KYC", disparamos un segundo POST a `/venues/:id/approve`
 * después del create — el server registra ambas en ActivityLog.
 */

interface FormState {
  // Organization
  orgMode: 'existing' | 'new'
  orgId: string
  orgName: string
  orgEmail: string
  orgPhone: string

  // Venue
  name: string
  slug: string
  venueType: VenueType
  entityType: EntityType
  rfc: string
  legalName: string

  // Address & contact (optional but recommended)
  address: string
  city: string
  state: string
  zipCode: string
  venuePhone: string
  venueEmail: string

  // Owner (optional)
  ownerEmail: string
  ownerFirstName: string
  ownerLastName: string

  // Features (codes)
  features: Set<string>

  // Admin overrides
  approveKyc: boolean
}

/**
 * Catálogo de venue types agrupado en 7 categorías operativas. El backend
 * acepta 35+ valores enum; aquí los presentamos por categorías. La
 * categoría va como `description` en el Combobox para que aparezca abajo
 * del label sin perder el agrupamiento visual.
 */
const VENUE_TYPE_GROUPS: Array<{
  label: string
  types: Array<{ value: VenueType; label: string }>
}> = [
  {
    label: 'Restaurantes y bares',
    types: [
      { value: 'RESTAURANT', label: 'Restaurante' },
      { value: 'BAR', label: 'Bar' },
      { value: 'CAFE', label: 'Café' },
      { value: 'BAKERY', label: 'Panadería' },
      { value: 'FAST_FOOD', label: 'Comida rápida' },
      { value: 'FOOD_TRUCK', label: 'Food truck' },
      { value: 'CATERING', label: 'Catering' },
      { value: 'CLOUD_KITCHEN', label: 'Cocina fantasma' },
    ],
  },
  {
    label: 'Tiendas',
    types: [
      { value: 'RETAIL_STORE', label: 'Tienda general' },
      { value: 'CLOTHING', label: 'Ropa' },
      { value: 'JEWELRY', label: 'Joyería' },
      { value: 'ELECTRONICS', label: 'Electrónica' },
      { value: 'PHARMACY', label: 'Farmacia' },
      { value: 'CONVENIENCE_STORE', label: 'Tienda de conveniencia' },
      { value: 'SUPERMARKET', label: 'Supermercado' },
      { value: 'LIQUOR_STORE', label: 'Vinatería' },
      { value: 'FURNITURE', label: 'Muebles' },
      { value: 'HARDWARE', label: 'Ferretería' },
      { value: 'BOOKSTORE', label: 'Librería' },
      { value: 'PET_STORE', label: 'Mascotas' },
      { value: 'TELECOMUNICACIONES', label: 'Telecomunicaciones' },
    ],
  },
  {
    label: 'Servicios',
    types: [
      { value: 'CLINIC', label: 'Clínica médica' },
      { value: 'VETERINARY', label: 'Veterinaria' },
      { value: 'FITNESS', label: 'Gimnasio / fitness' },
      { value: 'AUTO_SERVICE', label: 'Servicio automotriz' },
      { value: 'LAUNDRY', label: 'Lavandería' },
      { value: 'REPAIR_SHOP', label: 'Reparaciones' },
    ],
  },
  {
    label: 'Estéticas y spas',
    types: [
      { value: 'SALON', label: 'Estética / salón' },
      { value: 'SPA', label: 'Spa' },
    ],
  },
  {
    label: 'Hospedaje',
    types: [
      { value: 'HOTEL', label: 'Hotel' },
      { value: 'HOSTEL', label: 'Hostal' },
      { value: 'RESORT', label: 'Resort' },
    ],
  },
  {
    label: 'Entretenimiento',
    types: [
      { value: 'CINEMA', label: 'Cine' },
      { value: 'NIGHTCLUB', label: 'Antro / nightclub' },
      { value: 'EVENT_VENUE', label: 'Salón de eventos' },
      { value: 'ARCADE', label: 'Arcade' },
      { value: 'BOWLING', label: 'Bowling' },
    ],
  },
  {
    label: 'Otro',
    types: [{ value: 'OTHER', label: 'Otro / no listado' }],
  },
]

/**
 * Versión plana de `VENUE_TYPE_GROUPS` para el `Combobox` — cada opción
 * lleva su categoría en `description` para preservar el contexto visual.
 * `searchTokens` agrega la categoría como término de búsqueda para que
 * "tienda" matchee todos los retail options.
 */
const VENUE_TYPE_OPTIONS: ComboboxOption[] = VENUE_TYPE_GROUPS.flatMap((group) =>
  group.types.map((t) => ({
    value: t.value,
    label: t.label,
    description: group.label,
    searchTokens: group.label,
  })),
)

/** Single-select del binario Persona Física / Moral. Sólo 2 opciones — el Combobox sigue siendo consistente con el resto del form. */
const ENTITY_TYPE_OPTIONS: ComboboxOption[] = [
  { value: 'PERSONA_FISICA', label: 'Persona Física' },
  { value: 'PERSONA_MORAL', label: 'Persona Moral' },
]

const INITIAL_STATE: FormState = {
  orgMode: 'existing',
  orgId: '',
  orgName: '',
  orgEmail: '',
  orgPhone: '',
  name: '',
  slug: '',
  venueType: 'RESTAURANT',
  entityType: 'PERSONA_FISICA',
  rfc: '',
  legalName: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  venuePhone: '',
  venueEmail: '',
  ownerEmail: '',
  ownerFirstName: '',
  ownerLastName: '',
  features: new Set(),
  approveKyc: false,
}

/** Slug auto-generado del nombre — kebab-case ASCII. */
function autoSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export function NewVenuePage() {
  const navigate = useNavigate()
  const orgsQuery = useOrganizations()
  const featuresQuery = useFeatures()
  const createMutation = useCreateVenue()

  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  // Sub-sección "Datos fiscales" dentro de Identidad — colapsada por default.
  const [taxExpanded, setTaxExpanded] = useState(false)
  const [contactExpanded, setContactExpanded] = useState(false)
  const [ownerExpanded, setOwnerExpanded] = useState(false)
  const [featuresExpanded, setFeaturesExpanded] = useState(false)
  const [adminExpanded, setAdminExpanded] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cuando se cargan los features, pre-seleccionamos los `isCore: true`
  // una sola vez. Son los que casi todo venue necesita (pagos, etc.) —
  // el operador puede destildarlos si no aplica. Si el operador ya editó
  // la selección antes que llegue la respuesta, NO sobreescribimos.
  const [featuresInitialized, setFeaturesInitialized] = useState(false)
  useEffect(() => {
    if (!featuresQuery.data || featuresInitialized) return
    setFeaturesInitialized(true)
    const coreCodes = featuresQuery.data.filter((f) => f.isCore).map((f) => f.code)
    if (coreCodes.length > 0) {
      setForm((prev) =>
        // Solo pre-seleccionamos si el operador no movió ninguna casilla todavía.
        prev.features.size === 0 ? { ...prev, features: new Set(coreCodes) } : prev,
      )
    }
  }, [featuresQuery.data, featuresInitialized])

  // Slug auto-generado del nombre, editable. Si el operador lo personaliza,
  // dejamos de auto-actualizarlo — `slugTouched` lo marca.
  const [slugTouched, setSlugTouched] = useState(false)
  const previewSlug = slugTouched ? form.slug : autoSlug(form.name)

  const orgs = orgsQuery.data ?? []

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Limpiar el error del field cuando el usuario edita.
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as string]
        return next
      })
    }
  }

  const toggleFeature = (code: string) => {
    setForm((prev) => {
      const next = new Set(prev.features)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return { ...prev, features: next }
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}

    // Organization
    if (form.orgMode === 'existing' && !form.orgId) {
      next.orgId = 'Selecciona una organización'
    }
    if (form.orgMode === 'new') {
      if (!form.orgName.trim()) next.orgName = 'Nombre requerido'
      if (!form.orgEmail.trim()) next.orgEmail = 'Email requerido'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.orgEmail)) next.orgEmail = 'Email inválido'
      if (!form.orgPhone.trim()) next.orgPhone = 'Teléfono requerido'
    }

    // Venue
    if (!form.name.trim() || form.name.length < 2) {
      next.name = 'Mínimo 2 caracteres'
    }

    // RFC requerido cuando entityType es PERSONA_MORAL (siguiendo el schema)
    if (form.entityType === 'PERSONA_MORAL') {
      if (!form.rfc.trim()) next.rfc = 'RFC requerido para Persona Moral'
      else if (!RFC_REGEX.test(form.rfc.toUpperCase())) next.rfc = 'Formato de RFC inválido'
      if (!form.legalName.trim()) next.legalName = 'Razón social requerida para Persona Moral'
    } else if (form.rfc.trim() && !RFC_REGEX.test(form.rfc.toUpperCase())) {
      next.rfc = 'Formato de RFC inválido'
    }

    // Address & contact — sólo validamos lo que el operador escribió.
    // Si dejó todo vacío, está bien (estos campos son opcionales en el schema).
    if (form.address.trim() && form.address.trim().length < 5) {
      next.address = 'Mínimo 5 caracteres'
    }
    if (form.city.trim() && form.city.trim().length < 2) {
      next.city = 'Mínimo 2 caracteres'
    }
    if (form.state.trim() && form.state.trim().length < 2) {
      next.state = 'Mínimo 2 caracteres'
    }
    if (form.zipCode.trim() && form.zipCode.trim().length < 4) {
      next.zipCode = 'Mínimo 4 caracteres'
    }
    if (form.venueEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.venueEmail)) {
      next.venueEmail = 'Email inválido'
    }
    if (form.venuePhone.trim() && !/^[+]?[0-9\s\-()]+$/.test(form.venuePhone)) {
      next.venuePhone = 'Formato de teléfono inválido'
    }

    // Owner — si el operador empezó a llenar alguno, los pedimos todos
    if (ownerExpanded && (form.ownerEmail || form.ownerFirstName || form.ownerLastName)) {
      if (!form.ownerEmail) next.ownerEmail = 'Email requerido'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail))
        next.ownerEmail = 'Email inválido'
      if (!form.ownerFirstName) next.ownerFirstName = 'Nombre requerido'
      if (!form.ownerLastName) next.ownerLastName = 'Apellido requerido'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) {
      // Scroll al primer error para que el usuario lo vea.
      const firstError = document.querySelector('[data-field-error="true"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    const payload: CreateVenuePayload = {
      organization:
        form.orgMode === 'existing'
          ? { mode: 'existing', id: form.orgId }
          : {
              mode: 'new',
              name: form.orgName.trim(),
              email: form.orgEmail.trim(),
              phone: form.orgPhone.trim(),
            },
      venue: {
        name: form.name.trim(),
        slug: previewSlug || undefined,
        venueType: form.venueType,
        entityType: form.entityType,
        rfc: form.rfc.trim().toUpperCase() || undefined,
        legalName: form.legalName.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        phone: form.venuePhone.trim() || undefined,
        email: form.venueEmail.trim() || undefined,
      },
      team:
        ownerExpanded && form.ownerEmail
          ? {
              owner: {
                email: form.ownerEmail.trim(),
                firstName: form.ownerFirstName.trim(),
                lastName: form.ownerLastName.trim(),
                // Es el dueño legal del venue — role `OWNER`, no `ADMIN`.
                // `ADMIN` se reserva para Staff con permisos plenos pero sin
                // ownership. `OWNER` es el cap superior dentro del venue.
                role: 'OWNER',
              },
            }
          : undefined,
      features: form.features.size > 0 ? [...form.features] : undefined,
    }

    try {
      const result = await createMutation.mutateAsync({
        payload,
        approveKyc: form.approveKyc,
      })
      // El wizard responde 201 aunque un paso secundario falle (invitación del owner, features…).
      // No mostramos un éxito ciego: si algún step falló, avisamos qué quedó pendiente y aun así
      // llevamos al detalle para que el operador lo termine ahí.
      const failed = failedWizardSteps(result.steps)
      if (failed.length > 0) {
        toast.warning('Venue creado con pasos incompletos', {
          description: `Fallaron: ${failed.join(', ')}. Revísalos en el detalle del venue.`,
        })
      } else {
        toast.success('Venue creado', {
          description: form.approveKyc
            ? 'KYC pre-aprobado, venue ACTIVE. Listo para refinar configuración.'
            : 'Status inicial: ONBOARDING. Pasa por /kyc cuando los docs estén listos.',
        })
      }
      navigate(`/venues/${result.venueId}`)
    } catch (error) {
      const info = inspectApiError(error, 'crear el venue')
      toast.error(info.title, { description: info.description })
    }
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-6 md:px-8 lg:py-10">
      <Link
        to="/venues"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Venues
      </Link>

      <header className="mt-4 mb-8">
        <p className="eyebrow">Catálogo</p>
        <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
          Nuevo venue
        </h1>
        <p className="mt-3 max-w-[540px] text-[14px] text-[var(--ink-muted)]">
          Configura lo esencial — el venue queda en{' '}
          <code className="font-mono text-[12px] text-[var(--ink)]">ONBOARDING</code>. KYC,
          terminales, comisión y features se refinan después desde el detail del venue.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10" noValidate>
        <Section title="Identidad">
          <OrgSelector
            mode={form.orgMode}
            orgId={form.orgId}
            orgName={form.orgName}
            orgEmail={form.orgEmail}
            orgPhone={form.orgPhone}
            orgs={orgs}
            orgsLoading={orgsQuery.isLoading}
            errors={errors}
            onModeChange={(mode) => update('orgMode', mode)}
            onChange={(field, value) => update(field, value)}
          />

          <div className="mt-6 space-y-4 border-t border-[var(--line)] pt-6">
            <FormField id="venue-name" label="Nombre del venue" required error={errors.name}>
              <input
                id="venue-name"
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                onBlur={() => {
                  if (!slugTouched && form.name) update('slug', autoSlug(form.name))
                }}
                placeholder="Restaurante Pez Volador"
                className={inputClass(!!errors.name)}
                data-field-error={!!errors.name}
                autoFocus
              />
            </FormField>

            <FormField id="venue-slug" label="Slug" hint="Auto-generado del nombre. Editable.">
              <input
                id="venue-slug"
                type="text"
                value={previewSlug}
                onChange={(e) => {
                  setSlugTouched(true)
                  update('slug', e.target.value)
                }}
                placeholder="pez-volador"
                className={cn(inputClass(false), 'font-mono text-[12.5px]')}
              />
            </FormField>

            <FormField id="venue-type" label="Tipo">
              <Combobox
                value={form.venueType}
                onChange={(v) => update('venueType', v as VenueType)}
                options={VENUE_TYPE_OPTIONS}
                placeholder="Selecciona el tipo"
                searchPlaceholder="Buscar restaurante, retail, spa…"
              />
            </FormField>

            {/*
              Sub-sección "Datos fiscales" — colapsada por default. Para
              demos / TRIAL no hace falta llenarla; para producción se
              completa después en /venues/:id/kyc. Sólo cuando el operador
              marca PERSONA_MORAL aquí, el RFC + razón social se vuelven
              required (lo exige el zod schema del backend).
            */}
            <div className="rounded-[6px] border border-[var(--line)] bg-[var(--canvas-sunken)]/40">
              <button
                type="button"
                onClick={() => setTaxExpanded((v) => !v)}
                aria-expanded={taxExpanded}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-[var(--ink)]">Datos fiscales</p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">
                    Persona Física/Moral, RFC, razón social. Opcional ahora — se completan en KYC.
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)] transition-transform',
                    !taxExpanded && '-rotate-90',
                  )}
                  aria-hidden
                />
              </button>
              {taxExpanded && (
                <div className="space-y-4 border-t border-[var(--line)] px-3.5 py-4">
                  <FormField id="venue-entity" label="Persona fiscal">
                    <Combobox
                      value={form.entityType}
                      onChange={(v) => update('entityType', v as EntityType)}
                      options={ENTITY_TYPE_OPTIONS}
                      placeholder="Selecciona persona fiscal"
                    />
                  </FormField>
                  <FormField
                    id="venue-rfc"
                    label="RFC"
                    required={form.entityType === 'PERSONA_MORAL'}
                    hint={
                      form.entityType === 'PERSONA_MORAL'
                        ? 'Requerido para Persona Moral.'
                        : 'Opcional — para Persona Física se extrae de la CSF durante KYC.'
                    }
                    error={errors.rfc}
                  >
                    <input
                      id="venue-rfc"
                      type="text"
                      value={form.rfc}
                      onChange={(e) => update('rfc', e.target.value.toUpperCase())}
                      placeholder={
                        form.entityType === 'PERSONA_MORAL' ? 'PEZV880101AB1' : 'Opcional'
                      }
                      maxLength={13}
                      className={cn(inputClass(!!errors.rfc), 'font-mono')}
                      data-field-error={!!errors.rfc}
                    />
                  </FormField>
                  {form.entityType === 'PERSONA_MORAL' && (
                    <FormField
                      id="venue-legal-name"
                      label="Razón social"
                      required
                      error={errors.legalName}
                    >
                      <input
                        id="venue-legal-name"
                        type="text"
                        value={form.legalName}
                        onChange={(e) => update('legalName', e.target.value)}
                        placeholder="Restaurantes Pez Volador S.A. de C.V."
                        className={inputClass(!!errors.legalName)}
                        data-field-error={!!errors.legalName}
                      />
                    </FormField>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Dirección y contacto del venue"
          subtitle="Opcional ahora, pero compliance los exige antes de procesar pagos. Si los tienes a mano, llenalos aquí; sino se piden después."
          collapsed={!contactExpanded}
          onToggle={() => setContactExpanded((v) => !v)}
        >
          {contactExpanded && (
            <div className="space-y-4">
              <FormField id="venue-address" label="Dirección" error={errors.address}>
                <input
                  id="venue-address"
                  type="text"
                  value={form.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder="Av. Insurgentes Sur 1234"
                  className={inputClass(!!errors.address)}
                  data-field-error={!!errors.address}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField id="venue-city" label="Ciudad" error={errors.city}>
                  <input
                    id="venue-city"
                    type="text"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="CDMX"
                    className={inputClass(!!errors.city)}
                    data-field-error={!!errors.city}
                  />
                </FormField>
                <FormField id="venue-state" label="Estado" error={errors.state}>
                  <input
                    id="venue-state"
                    type="text"
                    value={form.state}
                    onChange={(e) => update('state', e.target.value)}
                    placeholder="Ciudad de México"
                    className={inputClass(!!errors.state)}
                    data-field-error={!!errors.state}
                  />
                </FormField>
                <FormField id="venue-zip" label="CP" error={errors.zipCode}>
                  <input
                    id="venue-zip"
                    type="text"
                    value={form.zipCode}
                    onChange={(e) => update('zipCode', e.target.value)}
                    placeholder="03100"
                    maxLength={5}
                    className={cn(inputClass(!!errors.zipCode), 'font-mono')}
                    data-field-error={!!errors.zipCode}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="venue-phone"
                  label="Teléfono del venue"
                  hint="Para soporte y notificaciones operativas."
                  error={errors.venuePhone}
                >
                  <input
                    id="venue-phone"
                    type="tel"
                    value={form.venuePhone}
                    onChange={(e) => update('venuePhone', e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className={inputClass(!!errors.venuePhone)}
                    data-field-error={!!errors.venuePhone}
                  />
                </FormField>
                <FormField
                  id="venue-email"
                  label="Email del venue"
                  hint="Distinto al del owner. Para alertas del sistema."
                  error={errors.venueEmail}
                >
                  <input
                    id="venue-email"
                    type="email"
                    value={form.venueEmail}
                    onChange={(e) => update('venueEmail', e.target.value)}
                    placeholder="contacto@pezvolador.mx"
                    className={inputClass(!!errors.venueEmail)}
                    data-field-error={!!errors.venueEmail}
                  />
                </FormField>
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Owner inicial"
          subtitle="Opcional. Si lo agregas ahora, se crea el Staff con rol OWNER (dueño legal del venue). Si lo dejas vacío, lo asignas después."
          collapsed={!ownerExpanded}
          onToggle={() => setOwnerExpanded((v) => !v)}
        >
          {ownerExpanded && (
            <div className="space-y-4">
              <FormField id="owner-email" label="Email del owner" error={errors.ownerEmail}>
                <input
                  id="owner-email"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => update('ownerEmail', e.target.value)}
                  placeholder="juan@pezvolador.mx"
                  className={inputClass(!!errors.ownerEmail)}
                  data-field-error={!!errors.ownerEmail}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField id="owner-first" label="Nombre" error={errors.ownerFirstName}>
                  <input
                    id="owner-first"
                    type="text"
                    value={form.ownerFirstName}
                    onChange={(e) => update('ownerFirstName', e.target.value)}
                    placeholder="Juan"
                    className={inputClass(!!errors.ownerFirstName)}
                    data-field-error={!!errors.ownerFirstName}
                  />
                </FormField>
                <FormField id="owner-last" label="Apellido" error={errors.ownerLastName}>
                  <input
                    id="owner-last"
                    type="text"
                    value={form.ownerLastName}
                    onChange={(e) => update('ownerLastName', e.target.value)}
                    placeholder="Pérez"
                    className={inputClass(!!errors.ownerLastName)}
                    data-field-error={!!errors.ownerLastName}
                  />
                </FormField>
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Features activos"
          subtitle={
            featuresQuery.data
              ? `${form.features.size} de ${featuresQuery.data.length} activos. Los marcados "core" arrancan pre-seleccionados; cada uno cuenta para la suscripción del venue.`
              : 'Cargando catálogo de features…'
          }
          collapsed={!featuresExpanded}
          onToggle={() => setFeaturesExpanded((v) => !v)}
        >
          {featuresExpanded && (
            <FeaturesPicker
              features={featuresQuery.data ?? []}
              loading={featuresQuery.isLoading}
              selected={form.features}
              onToggle={toggleFeature}
            />
          )}
        </Section>

        <Section
          title="Operaciones administrativas"
          subtitle="Para casos especiales. Estas acciones quedan registradas en activity log con tu nombre, timestamp e IP."
          warn
          collapsed={!adminExpanded}
          onToggle={() => setAdminExpanded((v) => !v)}
        >
          {adminExpanded && (
            <div className="space-y-4">
              <div
                className={cn(
                  'flex items-start gap-3 rounded-[6px] border p-3.5 transition-colors',
                  form.approveKyc
                    ? 'border-[var(--warn)]/40 bg-[var(--warn-faint)]'
                    : 'border-[var(--line)]',
                )}
              >
                <Checkbox
                  id="approve-kyc"
                  checked={form.approveKyc}
                  onCheckedChange={(checked) => update('approveKyc', !!checked)}
                  className="mt-0.5"
                />
                <label htmlFor="approve-kyc" className="min-w-0 flex-1 cursor-pointer">
                  <p className="text-[13px] font-medium text-[var(--ink)]">
                    Pre-aprobar KYC y activar el venue inmediatamente
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                    El venue salta la cola de revisión en{' '}
                    <code className="font-mono text-[11px]">/kyc</code> y arranca en{' '}
                    <code className="font-mono text-[11px]">ACTIVE</code>. Úsalo solo cuando ya
                    validaste los documentos por canales paralelos (email, llamada, documentación
                    física en el banco).
                  </p>
                </label>
              </div>
            </div>
          )}
        </Section>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-end">
          <Link
            to="/venues"
            className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-4 text-[13px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className={buttonVariants({ size: 'lg', className: 'gap-2 px-5' })}
          >
            {createMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            )}
            {createMutation.isPending ? 'Creando…' : 'Crear venue'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  warn,
  collapsed,
  onToggle,
  children,
}: {
  title: string
  subtitle?: string
  warn?: boolean
  collapsed?: boolean
  onToggle?: () => void
  children: React.ReactNode
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
              <div className="flex items-center gap-2">
                <h2
                  className={cn(
                    'font-display text-[18px] font-semibold tracking-[-0.015em]',
                    warn ? 'text-[var(--warn)]' : 'text-[var(--ink)]',
                  )}
                >
                  {title}
                </h2>
                {warn && <AlertTriangle className="h-3.5 w-3.5 text-[var(--warn)]" aria-hidden />}
              </div>
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
      {children}
    </section>
  )
}

function OrgSelector({
  mode,
  orgId,
  orgName,
  orgEmail,
  orgPhone,
  orgs,
  orgsLoading,
  errors,
  onModeChange,
  onChange,
}: {
  mode: 'existing' | 'new'
  orgId: string
  orgName: string
  orgEmail: string
  orgPhone: string
  orgs: OrganizationOption[]
  orgsLoading: boolean
  errors: Record<string, string>
  onModeChange: (mode: 'existing' | 'new') => void
  onChange: (field: keyof FormState, value: string) => void
}) {
  const sortedOrgs = useMemo(() => [...orgs].sort((a, b) => a.name.localeCompare(b.name)), [orgs])

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] p-0.5">
        <ModeButton active={mode === 'existing'} onClick={() => onModeChange('existing')}>
          Org existente
        </ModeButton>
        <ModeButton active={mode === 'new'} onClick={() => onModeChange('new')}>
          Org nueva
        </ModeButton>
      </div>

      {mode === 'existing' ? (
        <FormField
          id="org-id"
          label="Organización"
          required
          error={errors.orgId}
          hint={`${orgs.length} disponibles`}
        >
          <Combobox
            value={orgId}
            onChange={(v) => onChange('orgId', v)}
            options={sortedOrgs.map((org) => ({
              value: org.id,
              label: org.name,
              description: `${org.venueCount} ${org.venueCount === 1 ? 'venue' : 'venues'}${org.hasPaymentConfig ? ' · payment config' : ''}`,
              searchTokens: `${org.slug} ${org.email}`,
            }))}
            disabled={orgsLoading}
            placeholder={orgsLoading ? 'Cargando…' : 'Selecciona una organización'}
            searchPlaceholder="Buscar por nombre, slug o email…"
            emptyLabel="Sin organizaciones que coincidan"
          />
        </FormField>
      ) : (
        <div className="space-y-4">
          <FormField
            id="org-name"
            label="Nombre de la organización"
            required
            error={errors.orgName}
          >
            <input
              id="org-name"
              type="text"
              value={orgName}
              onChange={(e) => onChange('orgName', e.target.value)}
              placeholder="Grupo Pez Volador"
              className={inputClass(!!errors.orgName)}
              data-field-error={!!errors.orgName}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="org-email" label="Email" required error={errors.orgEmail}>
              <input
                id="org-email"
                type="email"
                value={orgEmail}
                onChange={(e) => onChange('orgEmail', e.target.value)}
                placeholder="contacto@pezvolador.mx"
                className={inputClass(!!errors.orgEmail)}
                data-field-error={!!errors.orgEmail}
              />
            </FormField>
            <FormField id="org-phone" label="Teléfono" required error={errors.orgPhone}>
              <input
                id="org-phone"
                type="tel"
                value={orgPhone}
                onChange={(e) => onChange('orgPhone', e.target.value)}
                placeholder="+52 55 1234 5678"
                className={inputClass(!!errors.orgPhone)}
                data-field-error={!!errors.orgPhone}
              />
            </FormField>
          </div>
        </div>
      )}
    </div>
  )
}

function FeaturesPicker({
  features,
  loading,
  selected,
  onToggle,
}: {
  features: PlatformFeature[]
  loading: boolean
  selected: Set<string>
  onToggle: (code: string) => void
}) {
  // Agrupar por categoría — el operador piensa "qué módulos le doy" no "qué
  // features individuales". Las categorías típicas son PAYMENTS, POS, ANALYTICS,
  // INTEGRATIONS, etc. (vienen del backend). Si una categoría está vacía,
  // simplemente no se renderiza.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, PlatformFeature[]>()
    for (const f of features) {
      const cat = f.category || 'OTHER'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(f)
    }
    // Sort categories: core categories first (donde haya alguno marcado core), luego alfabético.
    return [...byCategory.entries()].sort(([catA, listA], [catB, listB]) => {
      const aHasCore = listA.some((f) => f.isCore) ? 0 : 1
      const bHasCore = listB.some((f) => f.isCore) ? 0 : 1
      if (aHasCore !== bHasCore) return aHasCore - bHasCore
      return catA.localeCompare(catB)
    })
  }, [features])

  if (loading) {
    return <p className="text-[12.5px] text-[var(--ink-faint)]">Cargando features del backend…</p>
  }

  if (features.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        El backend no devolvió features. Verifica que `GET /dashboard/superadmin/features` esté
        respondiendo.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {grouped.map(([category, list]) => (
        <div key={category}>
          <p className="eyebrow mb-2">{humanizeFeatureCategory(category)}</p>
          <ul className="space-y-1">
            {list.map((feature) => {
              const isSelected = selected.has(feature.code)
              return (
                <li key={feature.id}>
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
                      onCheckedChange={() => onToggle(feature.code)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[var(--ink)]">
                          {feature.name}
                        </p>
                        {feature.isCore && (
                          <Badge size="sm" tone="accent">
                            core
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">
                        {feature.description}
                      </p>
                      {typeof feature.basePrice === 'number' && feature.basePrice > 0 && (
                        <p className="tabular mt-1 text-[10.5px] text-[var(--ink-faint)]">
                          ${feature.basePrice.toFixed(2)} MXN / mes
                        </p>
                      )}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Map de categoría del backend → label en español. */
function humanizeFeatureCategory(category: string): string {
  switch (category.toUpperCase()) {
    case 'PAYMENTS':
      return 'Pagos'
    case 'POS':
      return 'Punto de venta'
    case 'ANALYTICS':
      return 'Reportes y analytics'
    case 'INTEGRATIONS':
      return 'Integraciones'
    case 'INVENTORY':
      return 'Inventario'
    case 'RESERVATIONS':
      return 'Reservaciones'
    case 'LOYALTY':
      return 'Lealtad'
    case 'MARKETING':
      return 'Marketing'
    default:
      return category.charAt(0) + category.slice(1).toLowerCase()
  }
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-7 rounded-[4px] px-3 text-[12px] font-medium transition-colors',
        active
          ? 'bg-[var(--canvas)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.18)]'
          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </button>
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

/**
 * Wrapper de form-field local. `Field` del design system renderea su propio
 * `<input>` y no acepta children — necesitamos algo flexible que acepte
 * `<select>`, `<input>`, etc. arbitrarios.
 */
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
