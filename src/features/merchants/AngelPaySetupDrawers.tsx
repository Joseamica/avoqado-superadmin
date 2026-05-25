import { useState } from 'react'
import { Combobox } from '@/shared/ui/Combobox'
import { CardDrawer } from './SetupDrawerKit'
import { CARD_TYPES, humanizeCardType } from './types'
import type { AngelPayDraft } from './angelpay-setup'
import type { AngelPayAccountOption, VenueOption } from './api'

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
  onSave: (p: Pick<AngelPayDraft, 'venueId' | 'venueName'>) => void
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

export function CuentaDrawer({
  open,
  onOpenChange,
  draft,
  accounts,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  draft: AngelPayDraft
  accounts: AngelPayAccountOption[]
  onSave: (
    p: Pick<AngelPayDraft, 'loginMode' | 'angelpayUserAccountId' | 'email' | 'pin' | 'environment'>,
  ) => void
}) {
  const [mode, setMode] = useState(draft.loginMode)
  const [accId, setAccId] = useState(draft.angelpayUserAccountId ?? '')
  const [email, setEmail] = useState(draft.email)
  const [pin, setPin] = useState(draft.pin)
  const [env, setEnv] = useState(draft.environment)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Cuenta AngelPay"
      onSave={() =>
        onSave({
          loginMode: mode,
          angelpayUserAccountId: mode === 'existing' ? accId || null : null,
          email,
          pin,
          environment: env,
        })
      }
    >
      <div className="flex gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="ap-login"
            checked={mode === 'new'}
            onChange={() => setMode('new')}
          />{' '}
          Nueva
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="ap-login"
            checked={mode === 'existing'}
            onChange={() => setMode('existing')}
          />{' '}
          Existente
        </label>
      </div>
      {mode === 'existing' ? (
        <div>
          <label className={labelCls}>Cuenta</label>
          <Combobox
            value={accId}
            onChange={setAccId}
            options={accounts.map((a) => ({
              value: a.id,
              label: a.email,
              description: `${a.status} · ${a.environment}`,
            }))}
            ariaLabel="Cuenta AngelPay"
            placeholder="Elige una cuenta"
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls} htmlFor="ap-email">
              Correo
            </label>
            <input
              id="ap-email"
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ap-pin">
              PIN (6 dígitos)
            </label>
            <input
              id="ap-pin"
              className={inputCls}
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelCls}>Ambiente</label>
            <Combobox
              value={env}
              onChange={(v) => setEnv(v as AngelPayDraft['environment'])}
              options={[
                { value: 'QA', label: 'QA' },
                { value: 'PROD', label: 'PROD' },
              ]}
              ariaLabel="Ambiente"
            />
          </div>
        </>
      )}
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
  draft: AngelPayDraft
  onSave: (
    p: Pick<AngelPayDraft, 'externalMerchantId' | 'merchantName' | 'affiliation' | 'displayName'>,
  ) => void
}) {
  const [externalMerchantId, setExt] = useState(draft.externalMerchantId)
  const [merchantName, setName] = useState(draft.merchantName)
  const [affiliation, setAff] = useState(draft.affiliation)
  const [displayName, setDisplay] = useState(draft.displayName)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Merchant"
      onSave={() =>
        onSave({
          externalMerchantId: externalMerchantId.trim(),
          merchantName: merchantName.trim(),
          affiliation: affiliation.trim(),
          displayName: displayName.trim(),
        })
      }
    >
      <div>
        <label className={labelCls} htmlFor="ap-ext">
          ID del merchant (numérico)
        </label>
        <input
          id="ap-ext"
          className={inputCls}
          inputMode="numeric"
          value={externalMerchantId}
          onChange={(e) => setExt(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-name">
          Nombre
        </label>
        <input
          id="ap-name"
          className={inputCls}
          value={merchantName}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-aff">
          Afiliación
        </label>
        <input
          id="ap-aff"
          className={inputCls}
          value={affiliation}
          onChange={(e) => setAff(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-disp">
          Nombre visible
        </label>
        <input
          id="ap-disp"
          className={inputCls}
          value={displayName}
          onChange={(e) => setDisplay(e.target.value)}
          placeholder="Cuenta Principal"
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
  draft: AngelPayDraft
  onSave: (p: Pick<AngelPayDraft, 'accountType' | 'slotMode' | 'replacedAccountId'>) => void
}) {
  const [accountType, setAccountType] = useState(draft.accountType)
  const [slotMode, setSlotMode] = useState(draft.slotMode)
  const [replacedAccountId, setReplaced] = useState(draft.replacedAccountId ?? '')
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Slot"
      onSave={() =>
        onSave({
          accountType,
          slotMode,
          replacedAccountId: slotMode === 'replace' ? replacedAccountId || null : null,
        })
      }
    >
      <div>
        <label className={labelCls}>Slot</label>
        <Combobox
          value={accountType}
          onChange={(v) => setAccountType(v as AngelPayDraft['accountType'])}
          options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'SECONDARY', label: 'Secondary' },
            { value: 'TERTIARY', label: 'Tertiary' },
          ]}
          ariaLabel="Slot"
        />
      </div>
      <div>
        <label className={labelCls}>Modo</label>
        <Combobox
          value={slotMode}
          onChange={(v) => setSlotMode(v as AngelPayDraft['slotMode'])}
          options={[
            { value: 'fill', label: 'Llenar (vacío)' },
            { value: 'replace', label: 'Reemplazar' },
          ]}
          ariaLabel="Modo de slot"
        />
      </div>
      {slotMode === 'replace' && (
        <div>
          <label className={labelCls} htmlFor="ap-rep">
            ID de la cuenta a reemplazar
          </label>
          <input
            id="ap-rep"
            className={inputCls}
            value={replacedAccountId}
            onChange={(e) => setReplaced(e.target.value)}
          />
        </div>
      )}
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
  draft: AngelPayDraft
  onSave: (p: Pick<AngelPayDraft, 'settlement' | 'settlementDayType' | 'cutoffTime'>) => void
}) {
  const [s, setS] = useState(draft.settlement)
  const [dayType, setDayType] = useState(draft.settlementDayType)
  const [cutoff, setCutoff] = useState(draft.cutoffTime)
  const numCls =
    'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums'
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Liquidación"
      onSave={() => onSave({ settlement: s, settlementDayType: dayType, cutoffTime: cutoff })}
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
      <div>
        <label className={labelCls}>Tipo de días</label>
        <Combobox
          value={dayType}
          onChange={(v) => setDayType(v as AngelPayDraft['settlementDayType'])}
          options={[
            { value: 'BUSINESS_DAYS', label: 'Hábiles' },
            { value: 'CALENDAR_DAYS', label: 'Naturales' },
          ]}
          ariaLabel="Tipo de días"
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="ap-cut">
          Corte
        </label>
        <input
          id="ap-cut"
          className={`${numCls} w-24`}
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
          placeholder="23:00"
        />
      </div>
    </CardDrawer>
  )
}
