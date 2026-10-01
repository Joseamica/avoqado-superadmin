import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { Combobox } from '@/shared/ui/Combobox'
import { Checkbox } from '@/shared/ui/Checkbox'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { FilterPill } from '@/shared/filters/FilterPill'
import { MultiSelectFilterContent } from '@/shared/filters/MultiSelectFilterContent'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  fetchHybridCatalog,
  previewHybridCampaign,
  saveHybridCampaign,
  hybridPesos,
  type HybridCampaign,
  type HybridDefinition,
  type HybridDraft,
  type HybridPreview,
  type HybridTerms,
} from './hybrid-api'

/** Configurable functions of the catalog, paged by the server; the selection is kept across pages. */
export function FeaturePicker({
  codes,
  onChange,
  label,
}: {
  codes: string[]
  onChange: (codes: string[]) => void
  label: string
}) {
  const [search, setSearch] = useState(''),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const catalog = useQuery({
    queryKey: ['superadmin', 'hybrid-catalog', q, page],
    queryFn: () => fetchHybridCatalog({ q, page, pageSize: 25 }),
    staleTime: 60000,
  })
  const options = (catalog.data?.items ?? [])
    .filter((row) => row.offering === 'CONFIGURABLE' && row.featureCode)
    .map((row) => ({ value: row.featureCode!, label: row.name }))
  return (
    <div className="space-y-2">
      <p className="label">
        {label} · {codes.length} seleccionadas
      </p>
      <Field
        id={`${label}-search`}
        label="Buscar en todas las funcionalidades"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // The search runs as you type; Enter here must not submit the form around the picker.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
      />
      {catalog.isPending ? (
        <p role="status">Cargando catálogo…</p>
      ) : catalog.isError ? (
        <QueryError
          error={catalog.error}
          context="cargar el catálogo"
          onRetry={() => catalog.refetch()}
        />
      ) : (
        <>
          <FilterPill label={label} activeCount={codes.length} onClear={() => onChange([])}>
            <MultiSelectFilterContent
              title={label}
              options={options}
              selected={new Set(codes)}
              onApply={(selected) => onChange([...selected])}
              emptyLabel="No hay funciones configurables en esta página"
            />
          </FilterPill>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-muted)]">
            <span>
              {catalog.data.total} funcionalidades · página {page} de{' '}
              {Math.max(1, Math.ceil(catalog.data.total / 25))}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={page * 25 >= catalog.data.total}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
          <p className="text-sm text-[var(--ink-faint)]">
            La selección se conserva entre páginas. Las funciones base y de contratación asistida se
            muestran en el catálogo del cliente y no ocupan lugares del paquete.
          </p>
        </>
      )}
    </div>
  )
}

/** Mounted inside DrawerContent, so opening a loaded record initializes this form with its current revision. */
export function HybridCampaignEditor({
  campaign,
  duplicate = false,
  onSaved,
  onClose,
}: {
  campaign?: HybridCampaign
  duplicate?: boolean
  onSaved: (row: HybridCampaign) => void
  onClose: () => void
}) {
  const initial = campaign?.draftDefinition
  const [name, setName] = useState(campaign?.name ?? ''),
    [code, setCode] = useState(duplicate ? '' : (campaign?.code ?? '')),
    [slug, setSlug] = useState(duplicate ? '' : (campaign?.slug ?? ''))
  const [kind, setKind] = useState<HybridDefinition['kind']>(initial?.kind ?? 'CHOICE_BUNDLE'),
    [planTier, setPlanTier] = useState<'PRO' | 'PREMIUM'>(
      initial?.kind === 'PLAN' ? initial.planTier : 'PRO',
    )
  const [codes, setCodes] = useState(
    initial?.kind === 'CHOICE_BUNDLE'
      ? initial.eligibleFeatureCodes
      : initial?.kind === 'FEATURES'
        ? initial.featureCodes
        : [],
  )
  const [choiceCount, setChoiceCount] = useState(
    String(initial?.kind === 'CHOICE_BUNDLE' ? initial.choiceCount : 1),
  )
  const [price, setPrice] = useState(initial ? String(initial.terms.price) : ''),
    [renewalPrice, setRenewalPrice] = useState(
      initial?.terms.renewal.kind === 'REPRICE' ? String(initial.terms.renewal.price) : '',
    )
  const [renewal, setRenewal] = useState<HybridTerms['renewal']['kind']>(
      initial?.terms.renewal.kind ?? 'SAME_PRICE',
    ),
    [cycles, setCycles] = useState(
      initial?.terms.promotionCycles ? String(initial.terms.promotionCycles) : '',
    )
  const [range, setRange] = useState<DateRangeValue>({
    startTime: duplicate ? undefined : campaign?.startsAt,
    endTime: duplicate ? undefined : campaign?.endsAt,
  })
  const [capacity, setCapacity] = useState(campaign ? String(campaign.capacity) : ''),
    [audience, setAudience] = useState<HybridCampaign['audience']>(campaign?.audience ?? 'ALL'),
    [organizations, setOrganizations] = useState(
      campaign?.eligibleOrganizationIds.join('\n') ?? '',
    ),
    [listed, setListed] = useState(campaign?.listed ?? false)
  const [simulation, setSimulation] = useState<string[]>([]),
    [reviewed, setReviewed] = useState<{ definition: string; result: HybridPreview } | null>(null)
  const terms: HybridTerms = {
    currency: 'MXN',
    interval: 'MONTHLY',
    taxIncluded: true,
    price: Number(price),
    promotionCycles: cycles ? Number(cycles) : null,
    renewal:
      renewal === 'REPRICE' ? { kind: renewal, price: Number(renewalPrice) } : { kind: renewal },
  }
  const common = { schemaVersion: 1 as const, terms }
  const definition: HybridDefinition =
    kind === 'PLAN'
      ? { ...common, kind, planTier }
      : kind === 'FEATURES'
        ? { ...common, kind, featureCodes: codes }
        : { ...common, kind, choiceCount: Number(choiceCount), eligibleFeatureCodes: codes }
  const currentDefinition = JSON.stringify({
    definition,
    simulation: kind === 'CHOICE_BUNDLE' ? simulation : [],
  })
  const error = (e: unknown) => {
    const issue = inspectApiError(e, 'guardar la campaña')
    toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
  }
  const preview = useMutation({
    mutationFn: (input: {
      definition: HybridDefinition
      selection: string[]
      fingerprint: string
    }) => previewHybridCampaign(input.definition, input.selection),
    onSuccess: (result, input) => setReviewed({ definition: input.fingerprint, result }),
    onError: error,
  })
  const save = useMutation({
    mutationFn: () => {
      const draft: HybridDraft = {
        name,
        code,
        slug,
        startsAt: range.startTime!,
        endsAt: range.endTime!,
        capacity: Number(capacity),
        audience,
        eligibleOrganizationIds:
          audience === 'ORGANIZATIONS' ? organizations.split(/[\s,]+/).filter(Boolean) : [],
        listed,
        definition,
      }
      return saveHybridCampaign(draft, duplicate ? undefined : campaign)
    },
    onSuccess: onSaved,
    onError: error,
  })
  const reviewedNow = reviewed?.definition === currentDefinition
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        if (reviewedNow && range.startTime && range.endTime) save.mutate()
      }}
    >
      <div className="space-y-4">
        <Field
          id="hybrid-name"
          label="Nombre de la campaña"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={120}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="hybrid-code"
            label="Código"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={Boolean(campaign && !duplicate)}
            required
            pattern="[A-Z0-9][A-Z0-9_\-]{2,31}"
          />
          <Field
            id="hybrid-slug"
            label="Dirección de la oferta"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={Boolean(campaign && !duplicate)}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            hint="Identifica el enlace que compartirás en tu campaña."
          />
        </div>
      </div>
      <section className="space-y-4">
        <h3 className="eyebrow">Qué incluye</h3>
        <Combobox
          ariaLabel="Modalidad de oferta"
          value={kind}
          onChange={(value) => {
            setKind(value as HybridDefinition['kind'])
            setSimulation([])
          }}
          options={[
            { value: 'PLAN', label: 'Plan completo' },
            { value: 'FEATURES', label: 'Funciones específicas' },
            { value: 'CHOICE_BUNDLE', label: 'Paquete a elección' },
          ]}
        />
        {kind === 'PLAN' ? (
          <Combobox
            ariaLabel="Plan"
            value={planTier}
            onChange={(value) => setPlanTier(value as 'PRO' | 'PREMIUM')}
            options={[
              { value: 'PRO', label: 'Pro' },
              { value: 'PREMIUM', label: 'Premium' },
            ]}
          />
        ) : (
          <FeaturePicker
            codes={codes}
            onChange={setCodes}
            label={kind === 'CHOICE_BUNDLE' ? 'Funciones elegibles' : 'Funciones incluidas'}
          />
        )}
        {kind === 'CHOICE_BUNDLE' && (
          <Field
            id="hybrid-count"
            label="Cantidad a elegir"
            type="number"
            min={1}
            max={100}
            step={1}
            value={choiceCount}
            onChange={(e) => setChoiceCount(e.target.value)}
            required
          />
        )}
      </section>
      <section className="space-y-4">
        <h3 className="eyebrow">Precio y renovación</h3>
        <Field
          id="hybrid-price"
          label="Precio mensual con IVA"
          type="number"
          min={10}
          max={100000}
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          hint="Importe total del contrato, en pesos MXN."
        />
        <Combobox
          ariaLabel="Al terminar la promoción"
          value={renewal}
          onChange={(value) => setRenewal(value as HybridTerms['renewal']['kind'])}
          options={[
            { value: 'SAME_PRICE', label: 'Continúa al mismo precio' },
            { value: 'REPRICE', label: 'Renueva a otro precio' },
            { value: 'END', label: 'Termina sin renovación' },
          ]}
        />
        <Field
          id="hybrid-cycles"
          label="Ciclos de promoción"
          type="number"
          min={1}
          max={24}
          step={1}
          value={cycles}
          onChange={(e) => setCycles(e.target.value)}
          required={renewal !== 'SAME_PRICE'}
          hint={
            renewal === 'SAME_PRICE'
              ? 'Vacío significa precio continuo.'
              : 'Meses antes de aplicar la condición de renovación.'
          }
        />
        {renewal === 'REPRICE' && (
          <Field
            id="hybrid-renewal"
            label="Precio de renovación con IVA"
            type="number"
            min={10}
            max={100000}
            step="0.01"
            required
            value={renewalPrice}
            onChange={(e) => setRenewalPrice(e.target.value)}
          />
        )}
      </section>
      <section className="space-y-4">
        <h3 className="eyebrow">Disponibilidad</h3>
        <FilterPill
          label="Vigencia · Ciudad de México"
          activeLabel={range.startTime ? formatDateRangeLabel(range) : null}
          onClear={() => setRange({ startTime: undefined, endTime: undefined })}
          popoverClassName="w-auto"
        >
          <DateRangePicker value={range} onApply={setRange} showTime allowFuture />
        </FilterPill>
        <Field
          id="hybrid-capacity"
          label="Lugares disponibles"
          type="number"
          min={1}
          max={100000}
          step={1}
          required
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />
        <Combobox
          ariaLabel="Público"
          value={audience}
          onChange={(value) => setAudience(value as HybridCampaign['audience'])}
          options={[
            { value: 'ALL', label: 'Todos los clientes' },
            { value: 'NEW_ORGANIZATIONS', label: 'Organizaciones nuevas' },
            { value: 'ORGANIZATIONS', label: 'Organizaciones seleccionadas' },
          ]}
        />
        {audience === 'ORGANIZATIONS' && (
          <Field
            id="hybrid-orgs"
            label="Identificadores de las organizaciones"
            value={organizations}
            onChange={(e) => setOrganizations(e.target.value)}
            required
            hint="Separados por espacios o comas. El servidor valida el acceso al contratar."
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={listed} onCheckedChange={(value) => setListed(value === true)} />
          Mostrar en el catálogo público
        </label>
      </section>
      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <h3 className="eyebrow">Así se contratará</h3>
        <p>
          {kind === 'PLAN'
            ? `Plan ${planTier}`
            : kind === 'CHOICE_BUNDLE'
              ? `Elige ${choiceCount} funciones`
              : `${codes.length} funciones incluidas`}{' '}
          · <span className="tabular">{hybridPesos(Number(price))}</span> al mes, IVA incluido.
        </p>
        <p className="text-sm text-[var(--ink-muted)]">
          {renewal === 'END'
            ? `Termina después de ${cycles || '…'} meses.`
            : renewal === 'REPRICE'
              ? `Después de ${cycles || '…'} meses: ${hybridPesos(Number(renewalPrice))} al mes.`
              : 'Renueva al mismo precio.'}{' '}
          Comprar da acceso; los ajustes de uso se activan desde el negocio.
        </p>
        {kind === 'CHOICE_BUNDLE' && (
          <FeaturePicker label="Selección de prueba" codes={simulation} onChange={setSimulation} />
        )}
        <Button
          type="button"
          variant="secondary"
          disabled={preview.isPending || !price}
          onClick={() =>
            preview.mutate({
              definition,
              selection: kind === 'CHOICE_BUNDLE' ? simulation : [],
              fingerprint: currentDefinition,
            })
          }
        >
          Revisar oferta
        </Button>
        {reviewedNow && (
          <div role="status" className="space-y-2 text-sm">
            <p>
              Definición revisada. Guardar crea un borrador; publicar y activar son pasos separados.
            </p>
            {reviewed.result.selection.issues.map((issue) => (
              <p key={issue.code}>{issue.message}</p>
            ))}
            {reviewed.result.requirements.map((requirement) => (
              <p key={requirement.featureCode}>{requirement.message}</p>
            ))}
          </div>
        )}
      </section>
      <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--line)] pt-5">
        <Button type="button" variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button
          type="submit"
          disabled={!reviewedNow || save.isPending || !range.startTime || !range.endTime}
        >
          Guardar borrador
        </Button>
      </div>
    </form>
  )
}
