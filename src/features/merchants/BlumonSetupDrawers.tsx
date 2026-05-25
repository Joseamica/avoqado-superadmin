import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { CardRatesInput } from './CardRatesInput'
import { CARD_TYPES, humanizeCardType, type CardRates } from './types'
import type { VenueOption } from './api'
import { type BlumonDraft, ZERO_RATES } from './blumon-setup'

const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'

function CardDrawer({
  open,
  onOpenChange,
  title,
  children,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  children: React.ReactNode
  onSave: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex flex-col gap-4">{children}</div>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave()
              onOpenChange(false)
            }}
          >
            Guardar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

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
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: BlumonDraft
  onSave: (p: Pick<BlumonDraft, 'serialNumber' | 'brand' | 'model' | 'environment'>) => void
}) {
  const [serial, setSerial] = useState(draft.serialNumber)
  const [brand, setBrand] = useState(draft.brand)
  const [model, setModel] = useState(draft.model)
  const [env, setEnv] = useState(draft.environment)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Terminal Blumon"
      onSave={() => onSave({ serialNumber: serial.trim(), brand, model, environment: env })}
    >
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

export function RatesDrawer({
  open,
  onOpenChange,
  title,
  value,
  includesTax,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  value: CardRates | null
  includesTax: boolean
  onSave: (rates: CardRates, includesTax: boolean) => void
}) {
  const [rates, setRates] = useState<CardRates>(value ?? ZERO_RATES)
  const [tax, setTax] = useState(includesTax)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSave={() => onSave(rates, tax)}
    >
      <CardRatesInput value={rates} onChange={setRates} idPrefix="f5rate" />
      <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
        <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} /> Las tasas
        ya incluyen IVA
      </label>
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
