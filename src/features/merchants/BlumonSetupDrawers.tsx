import { useState } from 'react'
import { Combobox } from '@/shared/ui/Combobox'
import { Checkbox } from '@/shared/ui/Checkbox'
import { CARD_TYPES, humanizeCardType } from './types'
import type { VenueOption, WizardTerminal } from './api'
import { type BlumonDraft } from './blumon-setup'
import { RevenueShareFields } from './RevenueShareFields'
import { DEFAULT_REVENUE_SHARE_DRAFT, type RevenueShareDraft } from './revenue-share'
import { CardDrawer } from './SetupDrawerKit'

const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

export function VenueDrawer({
  open,
  onOpenChange,
  venues,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  venues: VenueOption[]
  value: string | null
  onSave: (p: Pick<BlumonDraft, 'venueId' | 'venueName'>) => void
}) {
  const [id, setId] = useState(value ?? '')
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Venue"
      onSave={() => {
        const v = venues.find((x) => x.id === id)
        onSave({ venueId: id || null, venueName: v?.name ?? null })
      }}
    >
      <div>
        <label className={labelCls}>Venue</label>
        <Combobox
          value={id}
          onChange={setId}
          options={venues.map((v) => ({ value: v.id, label: v.name, description: v.slug }))}
          ariaLabel="Venue"
          placeholder="Selecciona el venue"
        />
      </div>
    </CardDrawer>
  )
}

export function HardwareDrawer({
  open,
  onOpenChange,
  draft,
  venueTerminals,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  venueTerminals: WizardTerminal[]
  onSave: (
    p: Pick<BlumonDraft, 'serialNumber' | 'brand' | 'model' | 'environment' | 'terminalMode'>,
  ) => void
}) {
  const [mode, setMode] = useState<BlumonDraft['terminalMode']>(draft.terminalMode)
  const [serial, setSerial] = useState(draft.serialNumber)
  const [brand, setBrand] = useState(draft.brand)
  const [model, setModel] = useState(draft.model)
  const [env, setEnv] = useState(draft.environment)
  const [pickedId, setPickedId] = useState('')

  const terminalOptions = venueTerminals
    .filter((t) => t.serialNumber)
    .map((t) => ({
      value: t.id,
      label: `${t.serialNumber}${t.name ? ` · ${t.name}` : ''}`,
      description: [t.brand, t.model].filter(Boolean).join(' ') || undefined,
    }))

  function pickExisting(id: string) {
    setPickedId(id)
    const t = venueTerminals.find((x) => x.id === id)
    if (!t) return
    if (t.serialNumber) setSerial(t.serialNumber)
    if (t.brand) setBrand(t.brand)
    if (t.model) setModel(t.model)
  }

  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Terminal Blumon"
      onSave={() =>
        onSave({ serialNumber: serial.trim(), brand, model, environment: env, terminalMode: mode })
      }
    >
      <div className="flex gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="term-mode"
            checked={mode === 'serial'}
            onChange={() => setMode('serial')}
          />{' '}
          Por serial
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="term-mode"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
          />{' '}
          Elegir existente
        </label>
      </div>

      {mode === 'existing' ? (
        <div>
          <label className={labelCls}>Terminal del venue</label>
          {terminalOptions.length > 0 ? (
            <Combobox
              value={pickedId}
              onChange={pickExisting}
              options={terminalOptions}
              ariaLabel="Terminal del venue"
              placeholder="Selecciona una terminal"
            />
          ) : (
            <p className="text-[12.5px] text-[var(--ink-faint)]">
              {draft.venueId
                ? 'Este venue no tiene terminales registradas. Usa “Por serial”.'
                : 'Selecciona el venue primero para ver sus terminales.'}
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className={labelCls} htmlFor="serial">
            Serial
          </label>
          <input
            id="serial"
            className={inputCls}
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Marca</label>
        <Combobox
          value={brand}
          onChange={setBrand}
          options={[
            { value: 'PAX', label: 'PAX' },
            { value: 'NEXGO', label: 'NEXGO' },
          ]}
          ariaLabel="Marca"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="model">
          Modelo
        </label>
        <input
          id="model"
          className={inputCls}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="A910S"
        />
      </div>
      <div>
        <label className={labelCls}>Ambiente</label>
        <Combobox
          value={env}
          onChange={(v) => setEnv(v as BlumonDraft['environment'])}
          options={[
            { value: 'SANDBOX', label: 'Sandbox' },
            { value: 'PRODUCTION', label: 'Producción' },
          ]}
          ariaLabel="Ambiente"
        />
      </div>
      <p className="text-[11.5px] text-[var(--ink-faint)]">
        El server obtiene las credenciales (OAuth/DUKPT) de Blumon con este serial.
      </p>
    </CardDrawer>
  )
}

export function MerchantDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'displayName' | 'businessCategory'>) => void
}) {
  const [displayName, setDisplayName] = useState(draft.displayName)
  const [businessCategory, setBusinessCategory] = useState(draft.businessCategory)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Merchant"
      onSave={() =>
        onSave({ displayName: displayName.trim(), businessCategory: businessCategory.trim() })
      }
    >
      <div>
        <label className={labelCls} htmlFor="dn">
          Nombre visible
        </label>
        <input
          id="dn"
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Cuenta Principal"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="bc">
          Categoría de negocio (opcional)
        </label>
        <input
          id="bc"
          className={inputCls}
          value={businessCategory}
          onChange={(e) => setBusinessCategory(e.target.value)}
          placeholder="restaurant"
        />
      </div>
    </CardDrawer>
  )
}

export function SlotDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'accountSlot'>) => void
}) {
  const [slot, setSlot] = useState(draft.accountSlot)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Slot"
      onSave={() => onSave({ accountSlot: slot })}
    >
      <div>
        <label className={labelCls}>Slot de ruteo</label>
        <Combobox
          value={slot}
          onChange={(v) => setSlot(v as BlumonDraft['accountSlot'])}
          options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'SECONDARY', label: 'Secondary' },
            { value: 'TERTIARY', label: 'Tertiary' },
          ]}
          ariaLabel="Slot"
        />
      </div>
    </CardDrawer>
  )
}

export function SettlementDrawer({
  open,
  onOpenChange,
  draft,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  onSave: (s: BlumonDraft['settlement']) => void
}) {
  const [s, setS] = useState(draft.settlement)
  const numCls =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums'
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Liquidación"
      onSave={() => onSave(s)}
    >
      {CARD_TYPES.map((c) => (
        <label key={c} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-[var(--ink-muted)]">{humanizeCardType(c)}</span>
          <span className="inline-flex items-center gap-1 text-[var(--ink-faint)]">
            D+
            <input
              className={numCls}
              inputMode="numeric"
              aria-label={`Días ${humanizeCardType(c)}`}
              value={String(s[c])}
              onChange={(e) => setS({ ...s, [c]: Math.max(0, parseInt(e.target.value, 10) || 0) })}
            />
          </span>
        </label>
      ))}
    </CardDrawer>
  )
}

export function AdditionalTerminalsDrawer({
  open,
  onOpenChange,
  venueTerminals,
  mainSerial,
  mainBrand,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  venueTerminals: WizardTerminal[]
  mainSerial: string
  mainBrand: string
  value: string[]
  onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(value))

  // Sólo terminales del venue compatibles con la marca del merchant, con serial,
  // y distintas de la principal (que ya se auto-ata por serial). Filtrar por marca
  // evita que el backend rechace toda la alta por una terminal incompatible.
  const options = venueTerminals.filter(
    (t) => t.serialNumber && t.serialNumber !== mainSerial && (t.brand ?? mainBrand) === mainBrand,
  )

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Terminales TPV"
      onSave={() => onSave(Array.from(selected))}
    >
      <p className="text-[12.5px] text-[var(--ink-muted)]">
        La terminal del serial se ata sola. Aquí puedes atar otras terminales {mainBrand} del venue
        a esta cuenta.
      </p>
      {options.length === 0 ? (
        <p className="text-[12.5px] text-[var(--ink-faint)]">
          {venueTerminals.length === 0
            ? 'Este venue no tiene otras terminales registradas.'
            : `No hay otras terminales ${mainBrand} en este venue.`}
        </p>
      ) : (
        <ul className="flex flex-col gap-px">
          {options.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-2 text-[13px] text-[var(--ink-muted)] transition-colors hover:bg-[var(--canvas-sunken)]">
                <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                <span className="flex-1 truncate">
                  <span className="tabular-nums text-[var(--ink)]">{t.serialNumber}</span>
                  {t.name ? <span className="text-[var(--ink-faint)]"> · {t.name}</span> : null}
                </span>
                {(t.brand || t.model) && (
                  <span className="shrink-0 text-[11.5px] text-[var(--ink-faint)]">
                    {[t.brand, t.model].filter(Boolean).join(' ')}
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}
    </CardDrawer>
  )
}

export function RevenueShareDrawer({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: RevenueShareDraft | null
  onSave: (d: RevenueShareDraft) => void
}) {
  const [rs, setRs] = useState<RevenueShareDraft>(value ?? DEFAULT_REVENUE_SHARE_DRAFT)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Reparto de ganancias"
      onSave={() => onSave(rs)}
    >
      <p className="text-[12.5px] text-[var(--ink-muted)]">
        Por default Avoqado se queda con todo. Configura aquí el split con el agregador o el % del
        margen del proveedor; podrás ajustarlo después en el detalle.
      </p>
      <RevenueShareFields value={rs} onChange={setRs} />
    </CardDrawer>
  )
}
