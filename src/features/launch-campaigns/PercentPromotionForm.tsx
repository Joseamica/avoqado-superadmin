import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { Field } from '@/shared/ui/Field'
import {
  DateRangePicker,
  formatDateRangeLabel,
  type DateRangeValue,
} from '@/shared/ui/DateRangePicker'
import { FilterPill } from '@/shared/filters/FilterPill'
import { MultiSelectFilterContent } from '@/shared/filters/MultiSelectFilterContent'
import { DataTable } from '@/shared/data-table/DataTable'
import { apiErrorPayload, inspectApiError } from '@/shared/lib/api-error'
import { FEATURE_CATEGORIES } from '@/shared/lib/feature-categories'
import { formatMoney } from '@/shared/lib/money'
import { FeaturePicker } from './HybridCampaignEditor'
import {
  createPercent,
  fetchFeatureNames,
  previewPercent,
  type PercentPreviewRow,
  type PercentPromotionInput,
  type PercentTarget,
} from './hybrid-api'

const CATEGORY_OPTIONS = Object.entries(FEATURE_CATEGORIES).map(([value, label]) => ({
  value,
  label,
}))
const STATUS: Record<
  PercentPreviewRow['status'],
  { tone: 'success' | 'muted' | 'danger'; label: string }
> = {
  OK: { tone: 'success', label: 'Se genera' },
  NO_LIST: { tone: 'muted', label: 'Sin precio de lista activo (se omite)' },
  BELOW_MINIMUM: { tone: 'danger', label: 'Queda bajo $10' },
}
const wholeIn = (value: string, min: number, max: number) =>
  /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max
const money = (value: number | null) => (
  <span className="tabular block text-right">{value === null ? '—' : formatMoney(value)}</span>
)

/**
 * «Descuento %»: a % off the list price of each function, previewed by the server before creating the group (spec §4.3).
 * Mounted inside DrawerContent, so every opening starts from an empty form.
 */
export function PercentPromotionForm({ onCreated }: { onCreated: (groupId: string) => void }) {
  const [name, setName] = useState(''),
    [percent, setPercent] = useState(''),
    [kind, setKind] = useState<PercentTarget['kind']>('ALL_FEATURES'),
    [categories, setCategories] = useState<string[]>([]),
    [codes, setCodes] = useState<string[]>([]),
    [range, setRange] = useState<DateRangeValue>({}),
    [forever, setForever] = useState(true),
    [months, setMonths] = useState(''),
    [capacity, setCapacity] = useState('')
  const [reviewed, setReviewed] = useState<{
    fingerprint: string
    rows: PercentPreviewRow[]
    creatable: boolean
  } | null>(null)
  const names = useQuery({
    queryKey: ['superadmin', 'hybrid-feature-names'],
    queryFn: fetchFeatureNames,
    staleTime: 300_000,
  })

  const target: PercentTarget =
    kind === 'CATEGORIES'
      ? { kind, categories }
      : kind === 'FEATURES'
        ? { kind, featureCodes: codes }
        : { kind }
  const input: PercentPromotionInput = {
    name: name.trim(),
    percentOff: Number(percent),
    target,
    startsAt: range.startTime ?? '',
    endsAt: range.endTime ?? '',
    promotionCycles: forever ? null : Number(months),
    capacityPerFeature: Number(capacity),
  }
  const fingerprint = JSON.stringify(input)
  // A window that already ended can never sell: said on the field, not by the server after «Revisar».
  const ended = Boolean(range.endTime) && Date.parse(range.endTime!) <= Date.now()
  const ready =
    !ended &&
    input.name.length >= 3 &&
    wholeIn(percent, 1, 90) &&
    wholeIn(capacity, 1, 100_000) &&
    (forever || wholeIn(months, 1, 24)) &&
    Boolean(range.startTime && range.endTime) &&
    (kind !== 'CATEGORIES' || categories.length > 0) &&
    (kind !== 'FEATURES' || codes.length > 0)
  const current = reviewed?.fingerprint === fingerprint ? reviewed : null
  const below = current?.rows.filter((row) => row.status === 'BELOW_MINIMUM') ?? []

  const preview = useMutation({
    mutationFn: (body: PercentPromotionInput) => previewPercent(body),
    onSuccess: (result, body) => setReviewed({ fingerprint: JSON.stringify(body), ...result }),
    onError: (error) => {
      const issue = inspectApiError(error, 'revisar el descuento')
      toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
    },
  })
  const create = useMutation({
    mutationFn: () => createPercent(input),
    onSuccess: (result) => onCreated(result.groupId),
    onError: (error) => {
      const { code } = apiErrorPayload(error)
      const issue = inspectApiError(error, 'crear el descuento')
      // The lists moved since the preview: never create a group that differs from what was reviewed.
      if (code === 'HYBRID_PROMOTION_CHANGED' || code === 'HYBRID_PROMOTION_BELOW_MINIMUM') {
        setReviewed(null)
        preview.mutate(input)
        toast.error(
          code === 'HYBRID_PROMOTION_CHANGED'
            ? 'Un precio de lista cambió desde la vista previa'
            : 'Una función quedaría bajo $10',
          {
            description: `${code === 'HYBRID_PROMOTION_BELOW_MINIMUM' && issue.serverMessage ? `${issue.serverMessage} ` : ''}Ya actualizamos la vista previa: revísala y vuelve a crear el descuento.`,
          },
        )
        return
      }
      toast.error(issue.title, { description: issue.serverMessage ?? issue.description })
    },
  })

  const columns: ColumnDef<PercentPreviewRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Función',
      cell: ({ row }) => (
        <div>
          <p className="text-[var(--ink)]">{row.original.name}</p>
          {row.original.requires.map((code) => (
            <p key={code} className="text-[12px] text-[var(--ink-muted)]">
              {`Requiere ${names.data?.get(code) ?? code}`}
            </p>
          ))}
        </div>
      ),
    },
    { id: 'list', header: 'Lista', cell: ({ row }) => money(row.original.listPrice) },
    { id: 'price', header: 'Con descuento', cell: ({ row }) => money(row.original.price) },
    ...(forever
      ? []
      : [
          {
            id: 'renewal',
            header: 'Después',
            cell: ({ row }) => money(row.original.renewalPrice),
          } satisfies ColumnDef<PercentPreviewRow, unknown>,
        ]),
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge size="sm" tone={STATUS[row.original.status].tone}>
          {STATUS[row.original.status].label}
        </Badge>
      ),
    },
  ]

  return (
    // Only «Crear descuento» creates: Enter in a field, or paging the picker, never submits the group.
    <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
      <div className="space-y-4">
        <Field
          id="percent-name"
          label="Nombre del descuento"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={3}
          maxLength={120}
          hint="Cada promoción se llama «nombre · función»."
        />
        <Field
          id="percent-off"
          label="Porcentaje de descuento"
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          step={1}
          required
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          error={
            percent !== '' && !wholeIn(percent, 1, 90)
              ? 'Escribe un número entero entre 1 y 90.'
              : undefined
          }
          hint="Sobre el precio de lista de cada función, en pesos MXN con IVA incluido."
        />
      </div>
      <section className="space-y-4">
        <h3 className="eyebrow">A qué aplica</h3>
        <Combobox
          ariaLabel="A qué aplica"
          value={kind}
          onChange={(value) => setKind(value as PercentTarget['kind'])}
          options={[
            { value: 'ALL_FEATURES', label: 'Todas las funciones con precio' },
            { value: 'CATEGORIES', label: 'Categorías' },
            { value: 'FEATURES', label: 'Funciones' },
          ]}
        />
        {kind === 'CATEGORIES' && (
          <FilterPill
            label="Categorías"
            activeCount={categories.length}
            onClear={() => setCategories([])}
          >
            <MultiSelectFilterContent
              title="Categorías"
              options={CATEGORY_OPTIONS}
              selected={new Set(categories)}
              onApply={(selected) => setCategories([...selected])}
              searchable={false}
            />
          </FilterPill>
        )}
        {kind === 'FEATURES' && (
          <FeaturePicker label="Funciones" codes={codes} onChange={setCodes} />
        )}
        <p className="text-sm text-[var(--ink-muted)]">
          Sólo entran las funciones con precio de lista en venta; la vista previa dice cuáles se
          omiten.
        </p>
      </section>
      <section className="space-y-4">
        <h3 className="eyebrow">Vigencia y cupo</h3>
        <FilterPill
          label="Vigencia · Ciudad de México"
          activeLabel={range.startTime ? formatDateRangeLabel(range) : null}
          onClear={() => setRange({})}
          popoverClassName="w-auto"
        >
          <DateRangePicker value={range} onApply={setRange} showTime allowFuture />
        </FilterPill>
        {ended && (
          <p role="alert" className="text-[11.5px] text-[var(--danger)]">
            La vigencia ya terminó: elige una fecha final futura.
          </p>
        )}
        <Combobox
          ariaLabel="Cuánto dura el descuento"
          value={forever ? 'FOREVER' : 'MONTHS'}
          onChange={(value) => setForever(value === 'FOREVER')}
          options={[
            { value: 'FOREVER', label: 'Para siempre' },
            { value: 'MONTHS', label: 'Por N meses' },
          ]}
        />
        {!forever && (
          <Field
            id="percent-months"
            label="Meses con descuento"
            type="number"
            inputMode="numeric"
            min={1}
            max={24}
            step={1}
            required
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            error={
              months !== '' && !wholeIn(months, 1, 24)
                ? 'Escribe un número entero entre 1 y 24.'
                : undefined
            }
            hint="Después renueva al precio de lista vigente al crear el descuento."
          />
        )}
        <Field
          id="percent-capacity"
          label="Cupo por función"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          step={1}
          required
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          hint="El cupo es de cada función: un cupo de 10 con dos funciones admite hasta 10 contrataciones de cada una."
        />
      </section>
      <section className="space-y-4 border-t border-[var(--line)] pt-6">
        <h3 className="eyebrow">Vista previa</h3>
        <Button
          type="button"
          variant="secondary"
          disabled={!ready || preview.isPending}
          onClick={() => preview.mutate(input)}
        >
          {preview.isPending ? 'Revisando…' : 'Revisar'}
        </Button>
        {current && (
          <div className="space-y-3">
            <DataTable
              data={current.rows}
              columns={columns}
              searchPlaceholder="Buscar función"
              caption="Vista previa del descuento"
              minWidth={560}
              emptyState={{ title: 'Ninguna función entra en este objetivo' }}
            />
            {below.length > 0 ? (
              <p role="alert" className="text-sm text-[var(--danger)]">
                Quita las funciones que quedan bajo $10 o baja el porcentaje para poder crear el
                descuento: nunca se sube a $10, porque cambiaría el % prometido.
              </p>
            ) : !current.creatable ? (
              <p role="alert" className="text-sm text-[var(--danger)]">
                Ninguna de estas funciones tiene precio de lista activo. Ponle precio en Precios o
                elige otras.
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">
                Se crea pausado, con una promoción por función. Lo activas desde Descuentos %.
              </p>
            )}
          </div>
        )}
      </section>
      <div className="flex justify-end border-t border-[var(--line)] pt-5">
        <Button
          type="button"
          size="lg"
          disabled={!current?.creatable || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creando…' : 'Crear descuento'}
        </Button>
      </div>
    </form>
  )
}
