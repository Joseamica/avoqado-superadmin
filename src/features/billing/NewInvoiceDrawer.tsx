import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Field } from '@/shared/ui/Field'
import { Combobox } from '@/shared/ui/Combobox'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  discardInvoice,
  fetchTaxProfileById,
  fetchTaxProfileForCustomer,
  issueInvoice,
  uploadConstancia,
  upsertTaxProfile,
} from './api'
import { BILLING_QUERY_KEY, useCustomerSearch, useTaxProfileActions } from './use-billing'
import {
  CLAVE_PRODSERV_OPTIONS,
  CLAVE_UNIDAD_OPTIONS,
  FORMA_PAGO_OPTIONS,
  LINE_PRESETS,
  METODO_PAGO_OPTIONS,
  REGIMEN_FISCAL_OPTIONS,
  USO_CFDI_OPTIONS,
  centsToPesos,
  fileToBase64,
  formatCents,
  pesosToCents,
  previewTotals,
} from './catalogs'
import {
  humanizeCustomerKind,
  type BillingCustomerKind,
  type BillingTaxProfile,
  type CustomerSearchRow,
  type PlatformCfdi,
  type SatValidationField,
} from './types'

interface LineRow {
  id: string
  description: string
  satProductKey: string
  satUnitKey: string
  quantity: number
  unitPricePesos: number
  taxRate: number
  taxExempt: boolean
}

const newLine = (): LineRow => ({
  id: crypto.randomUUID(),
  description: '',
  satProductKey: '',
  satUnitKey: '',
  quantity: 1,
  unitPricePesos: 0,
  taxRate: 0.16,
  taxExempt: false,
})

export function NewInvoiceDrawer({
  open,
  onOpenChange,
  defaultSerie,
  retryFrom,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultSerie: string
  /** When set, the drawer opens pre-filled with this failed CFDI's data (Reintentar). */
  retryFrom?: PlatformCfdi | null
}) {
  const qc = useQueryClient()
  const { revalidate } = useTaxProfileActions()

  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState<CustomerSearchRow | null>(null)
  const [standalone, setStandalone] = useState(false)

  // Receptor fiscal fields
  const [rfc, setRfc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [regimenFiscal, setRegimenFiscal] = useState('601')
  const [codigoPostal, setCodigoPostal] = useState('')
  const [email, setEmail] = useState('')
  const [constanciaFile, setConstanciaFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SatValidationField, string>>>({})

  // Perfil fiscal del receptor seleccionado (fuente de verdad para el badge/lock de abajo).
  // `null` = sin perfil (no capturado todavía). Se distingue de `SatValidationResult` (la
  // respuesta puntual de una validación), que puede ser `null` = "no se pudo validar".
  const [profile, setProfile] = useState<BillingTaxProfile | null>(null)
  // El operador pidió "Corregir": vuelve a habilitar los campos aunque el perfil sea VALID.
  const [correctionMode, setCorrectionMode] = useState(false)

  // Lines + payment
  const [lines, setLines] = useState<LineRow[]>([newLine()])
  const [metodoPago, setMetodoPago] = useState<'PUE' | 'PPD'>('PUE')
  const [formaPago, setFormaPago] = useState('04')
  const [usoCfdi, setUsoCfdi] = useState('')
  const [serie, setSerie] = useState(defaultSerie)
  const [submitting, setSubmitting] = useState(false)

  const customerResults = useCustomerSearch(undefined, search)

  useEffect(() => {
    if (open) setSerie(defaultSerie)
  }, [open, defaultSerie])

  // PPD forces formaPago "99"; leaving PPD restores a sensible card default.
  useEffect(() => {
    if (metodoPago === 'PPD') setFormaPago('99')
    else setFormaPago((prev) => (prev === '99' ? '04' : prev))
  }, [metodoPago])

  function reset() {
    setSearch('')
    setCustomer(null)
    setStandalone(false)
    setRfc('')
    setRazonSocial('')
    setRegimenFiscal('601')
    setCodigoPostal('')
    setEmail('')
    setConstanciaFile(null)
    setFieldErrors({})
    setProfile(null)
    setCorrectionMode(false)
    setLines([newLine()])
    setMetodoPago('PUE')
    setFormaPago('04')
    setUsoCfdi('')
    setSubmitting(false)
  }

  /**
   * Prellena el formulario desde el perfil fiscal del receptor.
   *
   * La razón social NO tiene fallback a propósito: antes caía a `Venue.name` /
   * `Organization.name`, que son nombres COMERCIALES tecleados a mano y sin relación
   * legal con el RFC. En La Galeterie ese nombre traía un typo y se timbró tal cual
   * (incidente 2026-08-07). Sin perfil, el operador copia la razón social de la
   * Constancia de Situación Fiscal.
   */
  function prefillFromProfile(p: BillingTaxProfile | null, fallbackRfc?: string | null) {
    setRfc(p?.rfc ?? fallbackRfc ?? '')
    setRazonSocial(p?.razonSocial ?? '')
    setRegimenFiscal(p?.regimenFiscal ?? '601')
    setCodigoPostal(p?.codigoPostal ?? '')
    setEmail(p?.email ?? '')
    setUsoCfdi(p?.defaultUsoCfdi ?? '')
    setProfile(p)
    setCorrectionMode(false)
  }

  async function handleSelectCustomer(row: CustomerSearchRow) {
    setCustomer(row)
    setStandalone(false)
    setSearch('')
    setFieldErrors({})
    try {
      const profile =
        row.type === 'STANDALONE'
          ? await fetchTaxProfileById(row.id)
          : await fetchTaxProfileForCustomer(row.type, row.id)
      prefillFromProfile(profile, row.rfc)
    } catch {
      prefillFromProfile(null, row.rfc)
    }
  }

  function handleStandalone() {
    setStandalone(true)
    setCustomer(null)
    setSearch('')
    setFieldErrors({})
    prefillFromProfile(null)
  }

  /** Reintentar: rebuild the whole form from a failed CFDI so the operator can fix & re-stamp. */
  async function hydrateFromRetry(cfdi: PlatformCfdi) {
    const rows: LineRow[] = (cfdi.lines ?? []).map((l) => ({
      id: crypto.randomUUID(),
      description: l.description,
      satProductKey: l.satProductKey,
      satUnitKey: l.satUnitKey,
      quantity: l.quantity,
      unitPricePesos: centsToPesos(l.unitPriceCents),
      taxRate: l.taxRate ?? 0.16,
      taxExempt: Boolean(l.taxExempt),
    }))
    setLines(rows.length ? rows : [newLine()])
    setMetodoPago(cfdi.metodoPago)
    setFormaPago(cfdi.formaPago)
    setSerie(cfdi.serie ?? defaultSerie)

    // Prefer the linked tax profile (keeps org/venue linkage + email); else the CFDI receptor fields.
    let linked = false
    if (cfdi.billingTaxProfileId) {
      try {
        const profile = await fetchTaxProfileById(cfdi.billingTaxProfileId)
        if (profile) {
          prefillFromProfile(profile)
          if (profile.customerType === 'ORGANIZATION' && profile.organizationId) {
            setCustomer({
              type: 'ORGANIZATION',
              id: profile.organizationId,
              name: profile.razonSocial,
              rfc: profile.rfc,
              hasProfile: true,
            })
            setStandalone(false)
          } else if (profile.customerType === 'VENUE' && profile.venueId) {
            setCustomer({
              type: 'VENUE',
              id: profile.venueId,
              name: profile.razonSocial,
              rfc: profile.rfc,
              hasProfile: true,
            })
            setStandalone(false)
          } else {
            setCustomer(null)
            setStandalone(true)
          }
          linked = true
        }
      } catch {
        // fall through to the CFDI's own receptor fields
      }
    }
    if (!linked) {
      setRfc(cfdi.receptorRfc)
      setRazonSocial(cfdi.receptorNombre)
      setRegimenFiscal(cfdi.receptorRegimen)
      setCodigoPostal(cfdi.receptorCp)
      setCustomer(null)
      setStandalone(true)
      setProfile(null)
      setCorrectionMode(false)
    }
    setUsoCfdi(cfdi.usoCfdi) // the invoice's chosen uso wins over the profile default
  }

  // Reintentar: when opened with `retryFrom`, prefill the form from that failed CFDI.
  useEffect(() => {
    if (open && retryFrom) void hydrateFromRetry(retryFrom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, retryFrom?.id])

  const customerType: BillingCustomerKind | null = standalone
    ? 'STANDALONE'
    : (customer?.type ?? null)

  // Camino feliz de la Fase 3: el SAT ya validó el perfil del receptor → sólo lectura.
  // "Corregir" es la salida siempre disponible — el superadmin nunca queda bloqueado.
  const locked = profile?.validationStatus === 'VALID' && !correctionMode

  function handleRevalidate() {
    if (!profile) return
    revalidate.mutate(profile.id, {
      onSuccess: ({ profile: updated }) => {
        setProfile(updated)
        if (updated.validationStatus === 'VALID') setCorrectionMode(false)
      },
    })
  }

  const totals = useMemo(
    () =>
      previewTotals(
        lines.map((l) => ({
          quantity: l.quantity,
          unitPriceCents: pesosToCents(l.unitPricePesos),
          taxRate: l.taxRate,
          taxExempt: l.taxExempt,
        })),
      ),
    [lines],
  )

  const lineValid = (l: LineRow) =>
    l.description.trim() &&
    l.satProductKey.trim() &&
    l.satUnitKey.trim() &&
    l.quantity > 0 &&
    l.unitPricePesos > 0
  const receptorValid =
    rfc.trim().length >= 12 &&
    razonSocial.trim() &&
    /^\d{3}$/.test(regimenFiscal) &&
    /^\d{5}$/.test(codigoPostal)
  const canSubmit =
    Boolean(customerType) &&
    receptorValid &&
    lines.length > 0 &&
    lines.every(lineValid) &&
    formaPago &&
    !submitting

  const updateLine = (id: string, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const removeLine = (id: string) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))
  const addPreset = (presetKey: string) => {
    const preset = LINE_PRESETS.find((p) => p.key === presetKey)
    if (!preset) return
    const { unitPricePesos, ...rest } = preset.line
    setLines((prev) => [
      ...prev.filter((l) => lineValid(l)),
      { ...newLine(), ...rest, unitPricePesos, taxExempt: false },
    ])
  }

  async function handleSubmit() {
    if (!canSubmit || !customerType) return
    setSubmitting(true)
    try {
      const { profile, validation } = await upsertTaxProfile({
        customerType,
        organizationId: customer?.type === 'ORGANIZATION' ? customer.id : undefined,
        venueId: customer?.type === 'VENUE' ? customer.id : undefined,
        displayName: customerType === 'STANDALONE' ? razonSocial.trim().toUpperCase() : undefined,
        rfc: rfc.trim().toUpperCase(),
        razonSocial: razonSocial.trim().toUpperCase(),
        regimenFiscal,
        codigoPostal: codigoPostal.trim(),
        defaultUsoCfdi: usoCfdi || undefined,
        email: email.trim() || undefined,
      })

      // El SAT rechazó algún dato: se marca el campo y se aborta ANTES de gastar timbre.
      if (validation && !validation.valid) {
        const errores: Partial<Record<SatValidationField, string>> = {}
        for (const e of validation.errors) errores[e.field] = e.message
        setFieldErrors(errores)
        toast.error('El SAT no reconoce estos datos fiscales', {
          description: validation.errors.map((e) => e.message).join(' · '),
          duration: 30_000,
          closeButton: true,
        })
        return
      }
      setFieldErrors({})

      // Best-effort: subir la constancia si se adjuntó (no bloquea el timbrado).
      if (constanciaFile) {
        try {
          await uploadConstancia(
            profile.id,
            await fileToBase64(constanciaFile),
            constanciaFile.type || 'application/pdf',
          )
        } catch {
          toast.warning('No se pudo subir la constancia; la factura se timbrará de todas formas.')
        }
      }

      const cfdi = await issueInvoice({
        billingTaxProfileId: profile.id,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          satProductKey: l.satProductKey.trim(),
          satUnitKey: l.satUnitKey.trim(),
          quantity: l.quantity,
          unitPriceCents: pesosToCents(l.unitPricePesos),
          taxRate: l.taxExempt ? undefined : l.taxRate,
          taxExempt: l.taxExempt || undefined,
        })),
        formaPago,
        metodoPago,
        serie: serie.trim() || undefined,
        usoCfdi: usoCfdi || undefined,
      })

      // Reintentar: si venimos de una factura fallida, descártala para no dejarla apilada.
      if (retryFrom) {
        try {
          await discardInvoice(retryFrom.id)
        } catch {
          // best-effort cleanup — no bloquea el éxito del timbrado
        }
      }

      qc.invalidateQueries({ queryKey: [...BILLING_QUERY_KEY, 'invoices'] })
      toast.success('CFDI timbrado', {
        description: cfdi.uuid ? `Folio fiscal ${cfdi.uuid}` : undefined,
      })
      onOpenChange(false)
      reset()
    } catch (e) {
      const i = inspectApiError(e, 'timbrar la factura')
      // Un rechazo de datos trae la guía + el mensaje crudo del SAT: no se lee en los ~4 s
      // que dura un toast por defecto. 30 s le da tiempo de sobra sin quedarse pegado: un
      // toast `duration: Infinity` disparado dentro de este Drawer (Radix) nunca se cierra
      // solo — `react-dismissable-layer` pone `pointer-events:none` en <body>, y sonner no
      // fuerza `pointer-events:auto`, así que el closeButton queda inclicable. La única
      // salida era cerrar el Drawer, cuyo onOpenChange llama reset() y borra receptor,
      // conceptos y pago capturados.
      toast.error(i.title, {
        description: i.description,
        duration: i.kind === 'validation' ? 30_000 : undefined,
        closeButton: i.kind === 'validation',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Nueva factura</DrawerTitle>
          <DrawerSubtitle>Emite un CFDI a un cliente de Avoqado.</DrawerSubtitle>
        </DrawerHeader>
        <DrawerBody>
          {/* 1 · Cliente */}
          <section className="mb-6">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              1 · Cliente
            </h3>
            {customerType ? (
              <div className="flex items-center justify-between rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas-raised)] px-3.5 py-2.5">
                <div>
                  <p className="text-[13.5px] font-semibold text-[var(--ink)]">
                    {razonSocial || customer?.name || 'Receptor externo'}
                  </p>
                  <p className="text-[11px] text-[var(--ink-faint)]">
                    {humanizeCustomerKind(customerType)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomer(null)
                    setStandalone(false)
                    setFieldErrors({})
                    // Sin esto, el perfil (y su badge "Verificado con el SAT") del cliente
                    // anterior sigue vivo durante la ventana async de `handleSelectCustomer`
                    // del siguiente cliente — ver nota en `handleStandalone`/`prefillFromProfile`.
                    setProfile(null)
                    setCorrectionMode(false)
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Field
                  label="Buscar organización o venue"
                  name="customer-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre del cliente…"
                  hint="Escribe al menos 2 letras."
                />
                {search.trim().length >= 2 && (
                  <div className="mt-2 overflow-hidden rounded-[6px] border border-[var(--line)]">
                    {customerResults.isFetching ? (
                      <p className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] text-[var(--ink-muted)]">
                        <Search className="h-3.5 w-3.5" aria-hidden /> Buscando…
                      </p>
                    ) : customerResults.isError ? (
                      <p className="px-3.5 py-2.5 text-[12px] text-[var(--danger)]">
                        No se pudo buscar. Reintenta en un momento.
                      </p>
                    ) : (customerResults.data?.length ?? 0) === 0 ? (
                      <p className="px-3.5 py-2.5 text-[12px] text-[var(--ink-muted)]">
                        Sin resultados para «{search.trim()}». Si es una persona o empresa no
                        registrada como venue, usa “Receptor externo”.
                      </p>
                    ) : (
                      (customerResults.data ?? []).map((row) => (
                        <button
                          key={`${row.type}:${row.id}`}
                          onClick={() => handleSelectCustomer(row)}
                          className="flex w-full items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5 text-left last:border-0 hover:bg-[var(--canvas-raised)]"
                        >
                          <span className="text-[13px] text-[var(--ink)]">{row.name}</span>
                          <span className="flex items-center gap-2">
                            {row.hasProfile && (
                              <Badge tone="success" size="sm">
                                Con datos
                              </Badge>
                            )}
                            <Badge tone="muted" size="sm">
                              {humanizeCustomerKind(row.type)}
                            </Badge>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <Button variant="secondary" size="sm" onClick={handleStandalone} className="mt-3">
                  <UserPlus className="h-4 w-4" aria-hidden /> Receptor externo (no es venue)
                </Button>
              </>
            )}
          </section>

          {/* 2 · Datos fiscales del receptor */}
          {customerType && (
            <section className="mb-6">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                2 · Datos fiscales del receptor
              </h3>

              {locked && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[var(--success)]/30 bg-[var(--success-faint)] px-3.5 py-2.5">
                  <Badge tone="success" size="md">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Verificado con el SAT
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRevalidate}
                      disabled={revalidate.isPending}
                    >
                      {revalidate.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      Revalidar con el SAT
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCorrectionMode(true)}
                    >
                      Corregir
                    </Button>
                  </div>
                </div>
              )}
              {!profile && (
                <div className="mb-3 flex items-start gap-2.5 rounded-[6px] border border-[var(--warn)]/30 bg-[var(--warn-faint)] px-3.5 py-3 text-[13px] text-[var(--warn)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>Este venue todavía no ha capturado sus datos fiscales.</p>
                </div>
              )}
              {profile?.validationStatus === 'INVALID' && (
                <div className="mb-3 flex items-start gap-2.5 rounded-[6px] border border-[var(--danger)]/30 bg-[var(--danger-faint)] px-3.5 py-3 text-[13px] text-[var(--danger)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>El SAT no reconoce los datos fiscales de este venue.</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="RFC"
                  name="r-rfc"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value)}
                  error={fieldErrors.rfc}
                  disabled={locked}
                />
                <Field
                  label="Razón social"
                  name="r-name"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  placeholder="Tal como aparece en su Constancia"
                  hint='En MAYÚSCULAS y sin el régimen de capital (sin "S.A. DE C.V.").'
                  error={fieldErrors.razonSocial}
                  disabled={locked}
                />
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                    Régimen fiscal
                  </label>
                  <Combobox
                    value={regimenFiscal}
                    onChange={setRegimenFiscal}
                    options={REGIMEN_FISCAL_OPTIONS}
                    ariaLabel="Régimen fiscal del receptor"
                    disabled={locked}
                  />
                  {fieldErrors.regimenFiscal ? (
                    <p className="mt-1.5 text-[11.5px] text-[var(--danger)]">
                      {fieldErrors.regimenFiscal}
                    </p>
                  ) : null}
                </div>
                <Field
                  label="Código postal"
                  name="r-cp"
                  value={codigoPostal}
                  onChange={(e) => setCodigoPostal(e.target.value)}
                  error={fieldErrors.codigoPostal}
                  disabled={locked}
                />
                <Field
                  label="Correo (opcional)"
                  name="r-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErrors.email}
                  disabled={locked}
                />
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                    Uso CFDI
                  </label>
                  <Combobox
                    value={usoCfdi}
                    onChange={setUsoCfdi}
                    options={USO_CFDI_OPTIONS}
                    ariaLabel="Uso CFDI"
                    placeholder="Default del receptor"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                  Constancia de situación fiscal (PDF/imagen, opcional)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setConstanciaFile(e.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[13px] text-[var(--ink)] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[var(--canvas-raised)] file:px-2.5 file:py-1 file:text-[12px] file:text-[var(--ink)]"
                />
              </div>
            </section>
          )}

          {/* 3 · Conceptos */}
          {customerType && (
            <section className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                  3 · Conceptos
                </h3>
                <div className="flex gap-2">
                  {LINE_PRESETS.map((p) => (
                    <Button key={p.key} variant="ghost" size="sm" onClick={() => addPreset(p.key)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {lines.map((l) => (
                  <div key={l.id} className="rounded-[6px] border border-[var(--line)] p-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <Field
                        label="Descripción"
                        name={`l-desc-${l.id}`}
                        value={l.description}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                            Clave SAT
                          </label>
                          <Combobox
                            value={l.satProductKey}
                            onChange={(v) => updateLine(l.id, { satProductKey: v })}
                            options={CLAVE_PRODSERV_OPTIONS}
                            allowCustomValue
                            placeholder="Selecciona o escribe"
                            searchPlaceholder="Buscar clave de producto…"
                            ariaLabel="Clave de producto SAT"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                            Unidad
                          </label>
                          <Combobox
                            value={l.satUnitKey}
                            onChange={(v) => updateLine(l.id, { satUnitKey: v })}
                            options={CLAVE_UNIDAD_OPTIONS}
                            placeholder="Selecciona"
                            searchPlaceholder="Buscar unidad…"
                            emptyLabel="Sin coincidencias"
                            ariaLabel="Clave de unidad SAT"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field
                          label="Cantidad"
                          name={`l-qty-${l.id}`}
                          type="number"
                          min={1}
                          value={String(l.quantity)}
                          onChange={(e) =>
                            updateLine(l.id, { quantity: Number(e.target.value) || 0 })
                          }
                        />
                        <Field
                          label="Precio unitario (MXN)"
                          name={`l-price-${l.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={String(l.unitPricePesos)}
                          onChange={(e) =>
                            updateLine(l.id, { unitPricePesos: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between">
                        <label className="flex items-center gap-2 text-[12px] text-[var(--ink)]">
                          <input
                            type="checkbox"
                            checked={l.taxExempt}
                            onChange={(e) => updateLine(l.id, { taxExempt: e.target.checked })}
                            className="h-4 w-4 accent-[var(--accent)]"
                          />
                          Exento de IVA
                        </label>
                        <IconButton
                          size="sm"
                          aria-label="Quitar concepto"
                          onClick={() => removeLine(l.id)}
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="h-4 w-4" aria-hidden /> Agregar concepto
                </Button>
              </div>
            </section>
          )}

          {/* 4 · Pago */}
          {customerType && (
            <section className="mb-6">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                4 · Pago
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                    ¿Ya te pagó? (método)
                  </label>
                  <Combobox
                    value={metodoPago}
                    onChange={(v) => setMetodoPago(v as 'PUE' | 'PPD')}
                    options={METODO_PAGO_OPTIONS}
                    ariaLabel="Método de pago"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
                    Forma de pago
                  </label>
                  <Combobox
                    value={formaPago}
                    onChange={setFormaPago}
                    options={FORMA_PAGO_OPTIONS}
                    ariaLabel="Forma de pago"
                    disabled={metodoPago === 'PPD'}
                  />
                </div>
                <Field
                  label="Serie"
                  name="serie"
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                />
              </div>
              {metodoPago === 'PPD' && (
                <p className="mt-2 text-[12px] text-[var(--ink-muted)]">
                  PPD: se timbra como factura a crédito (forma 99). Cuando te paguen, emite el
                  complemento de pago.
                </p>
              )}
            </section>
          )}

          {/* Totals + submit */}
          {customerType && (
            <section className="mt-2 border-t border-[var(--line)] pt-4">
              <dl className="mb-4 space-y-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-[var(--ink-muted)]">Subtotal</dt>
                  <dd className="tabular font-medium text-[var(--ink)]">
                    {formatCents(totals.subtotalCents - totals.discountCents)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--ink-muted)]">IVA</dt>
                  <dd className="tabular font-medium text-[var(--ink)]">
                    {formatCents(totals.taxCents)}
                  </dd>
                </div>
                <div className="flex justify-between text-[15px]">
                  <dt className="font-semibold text-[var(--ink)]">Total</dt>
                  <dd className="tabular font-semibold text-[var(--ink)]">
                    {formatCents(totals.totalCents)}
                  </dd>
                </div>
              </dl>
              <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {submitting ? 'Timbrando…' : `Timbrar ${formatCents(totals.totalCents)}`}
              </Button>
            </section>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
