import { useState, type FormEvent, type ReactNode } from 'react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox } from '@/shared/ui/Combobox'
import { Field } from '@/shared/ui/Field'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import type { AdministrationUpdate, VenueAdministrationData } from './administration-api'
import { useUpdateVenueAdministration, useVenueAdministration } from './use-venue-administration'
import { ENTITY_TYPE_OPTIONS, VENUE_TYPE_OPTIONS } from './venue-options'
import { humanizeVenueStatus, VENUE_STATUS_TONE, type VenueStatus } from './types'

type Section = 'general' | 'contact' | 'legal' | 'organization' | 'owner' | 'status'
const TITLES: Record<Section, string> = {
  general: 'Datos generales',
  contact: 'Contacto y domicilio',
  legal: 'Registro legal',
  organization: 'Organización',
  owner: 'Contacto del responsable',
  status: 'Estado del negocio',
}
const FIELD_KEYS: Record<Exclude<Section, 'status'>, readonly string[]> = {
  general: ['name', 'slug', 'type', 'language'],
  contact: [
    'phone',
    'email',
    'website',
    'address',
    'city',
    'state',
    'country',
    'zipCode',
    'latitude',
    'longitude',
  ],
  legal: ['entityType', 'rfc', 'legalName', 'fiscalRegime'],
  organization: ['name', 'email', 'phone', 'taxId', 'billingEmail'],
  owner: ['firstName', 'lastName', 'phone'],
}
const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  slug: 'Slug',
  type: 'Giro',
  language: 'Idioma',
  phone: 'Teléfono',
  email: 'Email',
  website: 'Sitio web',
  address: 'Domicilio',
  city: 'Ciudad',
  state: 'Estado',
  country: 'País',
  zipCode: 'Código postal',
  latitude: 'Latitud',
  longitude: 'Longitud',
  entityType: 'Tipo de persona',
  rfc: 'RFC',
  legalName: 'Razón social',
  fiscalRegime: 'Régimen fiscal',
  taxId: 'Identificación fiscal',
  billingEmail: 'Email de facturación',
  firstName: 'Nombre',
  lastName: 'Apellidos',
}

function draftFor(section: Section, data: VenueAdministrationData): Record<string, string> {
  if (section === 'status') return { status: '', reason: '' }
  const source: Record<string, unknown> = {
    ...(section === 'organization'
      ? data.organization
      : section === 'owner'
        ? data.owner
        : data.venue),
  }
  return Object.fromEntries(FIELD_KEYS[section].map((key) => [key, String(source[key] ?? '')]))
}

function changedFields(initial: Record<string, string>, draft: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(draft)
      .filter(([key, value]) => value.trim() !== initial[key].trim())
      .map(([key, value]) => [
        key,
        value.trim() === ''
          ? null
          : key === 'latitude' || key === 'longitude'
            ? Number(value)
            : value.trim(),
      ]),
  )
}

export function VenueAdministration({ venueId }: { venueId: string }) {
  // A different venue must never inherit an open editor or an in-flight draft.
  return <Administration key={venueId} venueId={venueId} />
}

function Administration({ venueId }: { venueId: string }) {
  const query = useVenueAdministration(venueId)
  const [editing, setEditing] = useState<Section | null>(null)
  const data = query.data

  if (!data)
    return query.isError ? (
      <QueryError
        error={query.error}
        context="cargar los datos administrativos"
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    ) : (
      <p role="status" className="text-[13px] text-[var(--ink-muted)]">
        Cargando datos administrativos…
      </p>
    )

  const venue = data.venue
  const owner = data.owner
  const edit = (section: Section) => (
    <Button
      variant="secondary"
      onClick={() => setEditing(section)}
      aria-label={`Editar ${TITLES[section].toLowerCase()}`}
    >
      Editar
    </Button>
  )

  return (
    <>
      {query.isError && (
        <QueryError
          error={query.error}
          context="actualizar los datos administrativos"
          onRetry={() => query.refetch()}
        />
      )}
      <AdminSection title={TITLES.general} action={edit('general')}>
        <Row label="Nombre" value={venue.name} />
        <Row label="Slug" value={venue.slug} />
        <Row
          label="Giro"
          value={
            VENUE_TYPE_OPTIONS.find((option) => option.value === venue.type)?.label ?? venue.type
          }
        />
        <Row
          label="Idioma"
          value={
            venue.language === 'es'
              ? 'Español'
              : venue.language === 'en'
                ? 'Inglés'
                : venue.language
          }
        />
        <Row label="Moneda" value={venue.currency} />
        <Row label="Zona horaria" value={venue.timezone} />
      </AdminSection>
      <AdminSection title={TITLES.contact} action={edit('contact')}>
        <Row label="Teléfono" value={venue.phone} />
        <Row label="Email" value={venue.email} />
        <Row label="Sitio web" value={venue.website} />
        <Row label="Domicilio" value={venue.address} />
        <Row label="Ciudad" value={venue.city} />
        <Row label="Estado" value={venue.state} />
        <Row label="País" value={venue.country} />
        <Row label="Código postal" value={venue.zipCode} />
        <Row label="Latitud" value={venue.latitude} />
        <Row label="Longitud" value={venue.longitude} />
      </AdminSection>
      <AdminSection title={TITLES.legal} action={edit('legal')}>
        <Row
          label="Tipo de persona"
          value={ENTITY_TYPE_OPTIONS.find((option) => option.value === venue.entityType)?.label}
        />
        <Row label="RFC" value={venue.rfc} />
        <Row label="Razón social" value={venue.legalName} />
        <Row label="Régimen fiscal" value={venue.fiscalRegime} />
        <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
          Datos de registro. No modifican facturas emitidas ni la configuración del emisor CFDI.
        </p>
      </AdminSection>
      <AdminSection title={TITLES.organization} action={edit('organization')}>
        <Row label="Nombre" value={data.organization.name} />
        <Row label="Email" value={data.organization.email} />
        <Row label="Teléfono" value={data.organization.phone} />
        <Row label="Identificación fiscal" value={data.organization.taxId} />
        <Row label="Email de facturación" value={data.organization.billingEmail} />
        <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
          Datos compartidos por <span className="tabular">{data.organization.venueCount}</span>{' '}
          sucursales. La organización no se reasigna aquí.
        </p>
      </AdminSection>
      <AdminSection title={TITLES.owner} action={owner ? edit('owner') : undefined}>
        {owner ? (
          <>
            <Badge tone="muted">
              {owner.role === 'OWNER' ? 'Propietario (OWNER)' : 'Administrador de respaldo (ADMIN)'}
            </Badge>
            <Row label="Nombre" value={`${owner.firstName} ${owner.lastName}`} />
            <Row label="Email de acceso" value={owner.email} />
            <Row label="Teléfono" value={owner.phone} />
            <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
              Este contacto se comparte en <span className="tabular">{owner.venueCount}</span>{' '}
              sucursales. Su acceso, rol y titularidad se administran por separado.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[var(--ink-muted)]">
            No hay un propietario ni administrador activo vinculado a este negocio.
          </p>
        )}
      </AdminSection>
      <AdminSection
        title={TITLES.status}
        action={
          data.allowedStatusTransitions.length > 0 ? (
            <Button variant="secondary" onClick={() => setEditing('status')}>
              Cambiar estado
            </Button>
          ) : undefined
        }
      >
        <Badge tone={VENUE_STATUS_TONE[venue.status]}>{humanizeVenueStatus(venue.status)}</Badge>
        {venue.suspensionReason && (
          <p className="mt-3 text-[13px] text-[var(--ink)]">{venue.suspensionReason}</p>
        )}
        <p className="mt-3 text-[13px] text-[var(--ink-muted)]">
          Activar el negocio no aprueba su KYC ni cambia su plan.
          {data.allowedStatusTransitions.length === 0 && ' No hay cambios de estado disponibles.'}
        </p>
      </AdminSection>
      <Drawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DrawerContent>
          {editing && (
            <AdministrationForm
              section={editing}
              data={data}
              onClose={() => setEditing(null)}
              onRefresh={async () => (await query.refetch({ throwOnError: true })).data}
            />
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}

function AdminSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
        <h2 className="text-[14px] font-semibold text-[var(--ink)]">{title}</h2>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="label text-[var(--ink-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[13px] text-[var(--ink)]">
        {value ?? 'Sin registrar'}
      </span>
    </div>
  )
}

function AdministrationForm({
  section,
  data,
  onClose,
  onRefresh,
}: {
  section: Section
  data: VenueAdministrationData
  onClose: () => void
  onRefresh: () => Promise<VenueAdministrationData | undefined>
}) {
  // Mounted inside DrawerContent: seed once per opening; refetch must preserve the draft.
  const [snapshot, setSnapshot] = useState(data)
  const [baseline, setBaseline] = useState(() => draftFor(section, data))
  const [draft, setDraft] = useState(baseline)
  const [confirmed, setConfirmed] = useState(false)
  const [slugConfirmed, setSlugConfirmed] = useState(false)
  const [reviewRequired, setReviewRequired] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<unknown>(null)
  const [linkChanged, setLinkChanged] = useState(false)
  const mutation = useUpdateVenueAdministration(snapshot.venue.id)
  const changes = section === 'status' ? {} : changedFields(baseline, draft)
  const shared = section === 'organization' || section === 'owner'
  const slugChanged = section === 'general' && 'slug' in changes
  const reasonRequired = ['SUSPENDED', 'ADMIN_SUSPENDED', 'CLOSED'].includes(draft.status)
  const changed =
    section === 'status'
      ? snapshot.allowedStatusTransitions.includes(draft.status as VenueStatus)
      : Object.keys(changes).length > 0
  const canSave =
    changed &&
    !mutation.isPending &&
    !refreshing &&
    !linkChanged &&
    ((!shared && section !== 'status') || confirmed) &&
    (!slugChanged || slugConfirmed) &&
    (!reasonRequired || draft.reason.trim().length > 0) &&
    (!reviewRequired || reviewed)
  const update = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setReviewed(false)
  }

  async function reviewCurrent() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const fresh = await onRefresh()
      if (!fresh) return
      if (
        shared &&
        (section === 'organization'
          ? fresh.organization.id !== snapshot.organization.id
          : fresh.owner?.id !== snapshot.owner?.id)
      ) {
        setLinkChanged(true)
        return
      }
      const next = draftFor(section, fresh)
      const dirty = Object.keys(changes)
      setBaseline(next)
      setDraft(
        section === 'status'
          ? draft
          : { ...next, ...Object.fromEntries(dirty.map((key) => [key, draft[key]])) },
      )
      setSnapshot(fresh)
      setConfirmed(false)
      setReviewed(false)
      setReviewRequired(true)
      mutation.reset()
    } catch (error) {
      setRefreshError(error)
    } finally {
      setRefreshing(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    let payload: AdministrationUpdate
    if (section === 'organization')
      payload = {
        section,
        expectedUpdatedAt: snapshot.organization.updatedAt,
        expectedOrganizationId: snapshot.organization.id,
        confirmShared: true,
        changes,
      }
    else if (section === 'owner' && snapshot.owner)
      payload = {
        section,
        expectedUpdatedAt: snapshot.owner.updatedAt,
        expectedOwnerId: snapshot.owner.id,
        confirmShared: true,
        changes,
      }
    else if (section === 'status')
      payload = {
        section,
        expectedUpdatedAt: snapshot.venue.updatedAt,
        status: draft.status as VenueStatus,
        ...(draft.reason.trim() && { reason: draft.reason.trim() }),
      }
    else
      payload = {
        section: 'profile',
        expectedUpdatedAt: snapshot.venue.updatedAt,
        changes,
        ...(slugChanged && { confirmSlugChange: true }),
      }
    mutation.mutate(payload, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader onClose={onClose}>
        <DrawerTitle>{TITLES[section]}</DrawerTitle>
        <DrawerSubtitle className="whitespace-normal">
          {snapshot.venue.name} · Los cambios se guardan al confirmar.
        </DrawerSubtitle>
      </DrawerHeader>
      <DrawerBody className="space-y-5">
        <fieldset disabled={mutation.isPending || refreshing} className="space-y-4">
          {section === 'general' && (
            <>
              <Field
                name="name"
                label="Nombre del negocio"
                required
                minLength={2}
                maxLength={100}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
              <Field
                name="slug"
                label="Slug"
                required
                minLength={2}
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={draft.slug}
                onChange={(event) => {
                  update('slug', event.target.value)
                  setSlugConfirmed(false)
                }}
                hint={
                  <span className="text-[var(--ink-muted)]">
                    Identificador usado en los enlaces públicos.
                  </span>
                }
              />
              <div className="space-y-1.5">
                <p className="label text-[var(--ink-muted)]">Giro</p>
                <Combobox
                  ariaLabel="Giro"
                  className="text-[var(--ink-muted)]"
                  value={draft.type}
                  options={VENUE_TYPE_OPTIONS}
                  onChange={(value) => update('type', value)}
                />
              </div>
              <div className="space-y-1.5">
                <p className="label text-[var(--ink-muted)]">Idioma</p>
                <Combobox
                  ariaLabel="Idioma"
                  className="text-[var(--ink-muted)]"
                  value={draft.language}
                  options={[
                    { value: 'es', label: 'Español' },
                    { value: 'en', label: 'Inglés' },
                  ]}
                  onChange={(value) => update('language', value)}
                />
              </div>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Moneda: {snapshot.venue.currency} · Zona horaria: {snapshot.venue.timezone}. Sólo
                lectura.
              </p>
              {slugChanged && (
                <Confirmation checked={slugConfirmed} onChange={setSlugConfirmed}>
                  Los enlaces públicos anteriores dejarán de funcionar. Confirmo el cambio de slug.
                </Confirmation>
              )}
            </>
          )}
          {section === 'contact' && (
            <>
              <Field
                name="phone"
                label="Teléfono del negocio"
                type="tel"
                maxLength={30}
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
              <Field
                name="email"
                label="Email del negocio"
                type="email"
                maxLength={254}
                value={draft.email}
                onChange={(event) => update('email', event.target.value)}
              />
              <Field
                name="website"
                label="Sitio web"
                type="url"
                maxLength={2048}
                value={draft.website}
                onChange={(event) => update('website', event.target.value)}
                placeholder="https://"
              />
              <Field
                name="address"
                label="Domicilio"
                minLength={5}
                maxLength={200}
                value={draft.address}
                onChange={(event) => update('address', event.target.value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  name="city"
                  label="Ciudad"
                  minLength={2}
                  maxLength={100}
                  value={draft.city}
                  onChange={(event) => update('city', event.target.value)}
                />
                <Field
                  name="state"
                  label="Estado"
                  minLength={2}
                  maxLength={100}
                  value={draft.state}
                  onChange={(event) => update('state', event.target.value)}
                />
                <Field
                  name="country"
                  label="País"
                  maxLength={2}
                  pattern="[A-Z]{2}"
                  value={draft.country}
                  onChange={(event) => update('country', event.target.value.toUpperCase())}
                  hint={
                    <span className="text-[var(--ink-muted)]">
                      Código de 2 letras; México es MX.
                    </span>
                  }
                />
                <Field
                  name="zipCode"
                  label="Código postal"
                  minLength={4}
                  maxLength={10}
                  value={draft.zipCode}
                  onChange={(event) => update('zipCode', event.target.value)}
                />
                <Field
                  name="latitude"
                  label="Latitud"
                  type="number"
                  min={-90}
                  max={90}
                  step="any"
                  value={draft.latitude}
                  onChange={(event) => update('latitude', event.target.value)}
                />
                <Field
                  name="longitude"
                  label="Longitud"
                  type="number"
                  min={-180}
                  max={180}
                  step="any"
                  value={draft.longitude}
                  onChange={(event) => update('longitude', event.target.value)}
                />
              </div>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Vaciar un campo opcional elimina ese dato al guardar.
              </p>
            </>
          )}
          {section === 'legal' && (
            <>
              <div className="space-y-1.5">
                <p className="label text-[var(--ink-muted)]">Tipo de persona</p>
                <Combobox
                  ariaLabel="Tipo de persona"
                  className="text-[var(--ink-muted)]"
                  value={draft.entityType || '__none'}
                  options={[{ value: '__none', label: 'Sin registrar' }, ...ENTITY_TYPE_OPTIONS]}
                  onChange={(value) => update('entityType', value === '__none' ? '' : value)}
                />
              </div>
              <Field
                name="rfc"
                label="RFC"
                minLength={12}
                maxLength={13}
                value={draft.rfc}
                onChange={(event) => update('rfc', event.target.value.toUpperCase())}
              />
              <Field
                name="legalName"
                label="Razón social"
                minLength={3}
                maxLength={300}
                value={draft.legalName}
                onChange={(event) => update('legalName', event.target.value)}
              />
              <Field
                name="fiscalRegime"
                label="Régimen fiscal"
                inputMode="numeric"
                maxLength={3}
                pattern="[0-9]{3}"
                value={draft.fiscalRegime}
                onChange={(event) => update('fiscalRegime', event.target.value)}
                hint={
                  <span className="text-[var(--ink-muted)]">
                    Clave de 3 dígitos; por ejemplo, 601.
                  </span>
                }
              />
              <p className="text-[13px] text-[var(--ink-muted)]">
                Sólo registro administrativo. No modifica facturas emitidas ni la configuración del
                emisor CFDI.
              </p>
            </>
          )}
          {section === 'organization' && (
            <>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Esta organización se comparte entre {snapshot.organization.venueCount} sucursales.
                Todas verán estos datos nuevos.
              </p>
              <Field
                name="name"
                label="Nombre de la organización"
                required={'name' in changes}
                minLength={2}
                maxLength={100}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
              <Field
                name="email"
                label="Email de la organización"
                type="email"
                required={'email' in changes}
                maxLength={254}
                value={draft.email}
                onChange={(event) => update('email', event.target.value)}
              />
              <Field
                name="phone"
                label="Teléfono de la organización"
                type="tel"
                required={'phone' in changes}
                minLength={7}
                maxLength={30}
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
              <Field
                name="taxId"
                label="Identificación fiscal"
                minLength={12}
                maxLength={13}
                value={draft.taxId}
                onChange={(event) => update('taxId', event.target.value.toUpperCase())}
              />
              <Field
                name="billingEmail"
                label="Email de facturación"
                type="email"
                maxLength={254}
                value={draft.billingEmail}
                onChange={(event) => update('billingEmail', event.target.value)}
              />
            </>
          )}
          {section === 'owner' && snapshot.owner && (
            <>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Contacto compartido en {snapshot.owner.venueCount} sucursales. El cambio no
                transfiere el negocio ni modifica permisos.
              </p>
              <Field
                name="firstName"
                label="Nombre del responsable"
                required
                maxLength={100}
                value={draft.firstName}
                onChange={(event) => update('firstName', event.target.value)}
              />
              <Field
                name="lastName"
                label="Apellidos del responsable"
                required
                maxLength={100}
                value={draft.lastName}
                onChange={(event) => update('lastName', event.target.value)}
              />
              <Field
                name="phone"
                label="Teléfono del responsable"
                type="tel"
                maxLength={30}
                value={draft.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
              <Field
                name="accessEmail"
                label="Email de acceso"
                readOnly
                value={snapshot.owner.email}
                hint={
                  <span className="text-[var(--ink-muted)]">
                    El email identifica su acceso global. No se cambia desde esta ficha.
                  </span>
                }
              />
            </>
          )}
          {section === 'status' && (
            <>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Estado actual: {humanizeVenueStatus(snapshot.venue.status)}.
              </p>
              <div className="space-y-1.5">
                <p className="label text-[var(--ink-muted)]">Nuevo estado</p>
                <Combobox
                  ariaLabel="Nuevo estado"
                  className="text-[var(--ink-muted)]"
                  value={draft.status}
                  onChange={(value) => {
                    update('status', value)
                    setConfirmed(false)
                  }}
                  options={snapshot.allowedStatusTransitions.map((status) => ({
                    value: status,
                    label: humanizeVenueStatus(status),
                  }))}
                />
              </div>
              <Field
                name="reason"
                label="Motivo"
                required={reasonRequired}
                maxLength={1000}
                value={draft.reason}
                onChange={(event) => update('reason', event.target.value)}
                hint={
                  <span className="text-[var(--ink-muted)]">
                    {reasonRequired
                      ? 'Obligatorio al pausar, suspender o cerrar.'
                      : 'Opcional para esta transición.'}
                  </span>
                }
              />
              <p className="text-[13px] text-[var(--ink-muted)]">
                Pausar, suspender o cerrar impide la operación del negocio. Activar no aprueba KYC
                ni cambia el plan.
              </p>
            </>
          )}
          {(shared || section === 'status') && (
            <Confirmation checked={confirmed} onChange={setConfirmed}>
              {shared
                ? 'Confirmo el cambio de estos datos compartidos.'
                : `Confirmo cambiar el estado${draft.status ? ` a ${humanizeVenueStatus(draft.status as VenueStatus)}` : ''}.`}
            </Confirmation>
          )}
          {reviewRequired && (
            <>
              <p className="text-[13px] text-[var(--ink-muted)]">
                Revisión actual cargada. Tu borrador conserva únicamente los campos que editaste:
              </p>
              {Object.entries(changes).map(([key, value]) => (
                <p key={key} className="break-words text-[13px] text-[var(--ink)]">
                  {FIELD_LABELS[key]}: {baseline[key] || 'Sin registrar'} →{' '}
                  {value ?? 'Sin registrar'}
                </p>
              ))}
              {section === 'status' && draft.status && (
                <p className="text-[13px] text-[var(--ink)]">
                  {humanizeVenueStatus(snapshot.venue.status)} →{' '}
                  {humanizeVenueStatus(draft.status as VenueStatus)}
                </p>
              )}
              <Confirmation checked={reviewed} onChange={setReviewed}>
                Revisé los datos actuales y confirmo conservar mi borrador.
              </Confirmation>
            </>
          )}
        </fieldset>
        {mutation.isError && (
          <>
            <QueryError error={mutation.error} context="guardar los datos administrativos" />
            {inspectApiError(mutation.error).status === 409 && (
              <>
                <p className="text-[13px] text-[var(--ink-muted)]">
                  Conservamos tu borrador. Carga los datos actuales y revísalos antes de volver a
                  guardar.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void reviewCurrent()}
                  disabled={refreshing}
                >
                  {refreshing ? 'Cargando…' : 'Revisar datos actuales'}
                </Button>
              </>
            )}
          </>
        )}
        {refreshError !== null && (
          <QueryError error={refreshError} context="cargar la revisión actual" />
        )}
        {linkChanged && (
          <p role="alert" className="text-[13px] text-[var(--ink-muted)]">
            Cambió la organización o el responsable vinculado. Cierra y vuelve a abrir esta sección
            para revisar a quién vas a editar. Tu borrador permanece aquí.
          </p>
        )}
      </DrawerBody>
      <DrawerFooter className="flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="h-11 w-full sm:w-auto"
          variant={section === 'status' && reasonRequired ? 'danger' : 'primary'}
          disabled={!canSave}
        >
          {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </DrawerFooter>
    </form>
  )
}

function Confirmation({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-[13px] text-[var(--ink)]">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {children}
    </label>
  )
}
