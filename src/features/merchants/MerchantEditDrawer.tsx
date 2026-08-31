import { useState } from 'react'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { inspectApiError } from '@/shared/lib/api-error'
import { CardRatesInput } from './CardRatesInput'
import {
  buildIdentityPatch,
  costChanged,
  initMerchantEditDraft,
  providerKind,
  settlementChanged,
  validateMerchantEditDraft,
  type MerchantEditDraft,
} from './merchant-edit'
import { useSaveCost, useSaveSettlement, useUpdateMerchant } from './use-merchants'
import {
  CARD_TYPES,
  humanizeCardType,
  type CardType,
  type MerchantAccount,
  type ProviderCostStructure,
  type SettlementConfiguration,
  type SettlementDayType,
} from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchant: MerchantAccount
  cost: ProviderCostStructure | null
  settlements: SettlementConfiguration[]
  onSaved?: () => void
}

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'
const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--ring)]'
const numCls =
  'h-9 w-16 rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-2.5 text-[13px] tabular-nums ' +
  'focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

/**
 * Editor completo de una cuenta de pago, desde el botón «Editar» del detalle.
 *
 * Muestra el juego de campos del proveedor de ESTA cuenta (Blumon o AngelPay);
 * el proveedor en sí no se cambia — mover una cuenta de Blumon a AngelPay no es
 * una edición, son credenciales, hardware y afiliación distintos.
 *
 * Guarda en tres llamadas independientes y sólo las que hagan falta: identidad
 * (incluye banco, columnas del proveedor y rotación de credenciales), costo del
 * proveedor y liquidación. Reusa exactamente los mismos endpoints que las
 * tarjetas Economía y Liquidación del detalle, así que no hay dos verdades.
 */
export function MerchantEditDrawer({
  open,
  onOpenChange,
  merchant,
  cost,
  settlements,
  onSaved,
}: Props) {
  const kind = providerKind(merchant.provider.code)
  const updateM = useUpdateMerchant()
  const saveCostM = useSaveCost()
  const saveSettlementM = useSaveSettlement()

  const [draft, setDraft] = useState<MerchantEditDraft>(() =>
    initMerchantEditDraft(merchant, cost, settlements),
  )
  const [error, setError] = useState<string | null>(null)

  const saving = updateM.isPending || saveCostM.isPending || saveSettlementM.isPending
  const patch = <K extends keyof MerchantEditDraft>(key: K, value: MerchantEditDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const invalid = validateMerchantEditDraft(draft, kind)
    if (invalid) {
      setError(invalid)
      return
    }

    try {
      const identityPatch = buildIdentityPatch(draft, merchant, kind)
      if (Object.keys(identityPatch).length > 0) {
        await updateM.mutateAsync({ id: merchant.id, input: identityPatch })
      }

      if (costChanged(draft, cost)) {
        await saveCostM.mutateAsync({
          merchantAccountId: merchant.id,
          activeId: cost?.id ?? null,
          input: {
            rates: draft.rates,
            includesTax: draft.ratesIncludeTax,
            taxRate: cost?.taxRate ?? 0.16,
            fixedCostPerTransaction: cost?.fixedCostPerTransaction ?? null,
          },
        })
      }

      if (settlementChanged(draft, settlements)) {
        await saveSettlementM.mutateAsync({
          merchantAccountId: merchant.id,
          rows: CARD_TYPES.map((card) => ({
            cardType: card,
            settlementDays: draft.settlementDays[card],
            settlementDayType: draft.settlementDayType,
          })),
          cutoffTime: draft.cutoffTime.trim(),
          cutoffTimezone: settlements[0]?.cutoffTimezone || 'America/Mexico_City',
          existingByCard: Object.fromEntries(settlements.map((s) => [s.cardType, s.id])),
        })
      }

      toast.success('Cuenta actualizada')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      const i = inspectApiError(err, 'guardar la cuenta')
      setError(i.description)
      toast.error(i.title, { description: i.description })
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Editar cuenta</DrawerTitle>
          <DrawerSubtitle>
            Campos de {merchant.provider.name}. El proveedor no se puede cambiar.
          </DrawerSubtitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-5">
              <Section title="Identidad">
                <TextField
                  id="me-ext"
                  label="ID de comercio"
                  value={draft.externalMerchantId}
                  onChange={(v) => patch('externalMerchantId', v)}
                />
                <TextField
                  id="me-dn"
                  label="Nombre visible"
                  value={draft.displayName}
                  placeholder="Cuenta Principal"
                  onChange={(v) => patch('displayName', v)}
                />
                <TextField
                  id="me-alias"
                  label="Alias"
                  value={draft.alias}
                  onChange={(v) => patch('alias', v)}
                />
              </Section>

              {kind === 'blumon' && (
                <Section title="Datos Blumon">
                  <TextField
                    id="me-serial"
                    label="Serial de la terminal"
                    value={draft.blumonSerialNumber}
                    placeholder="2841548417"
                    onChange={(v) => patch('blumonSerialNumber', v)}
                  />
                  <TextField
                    id="me-posid"
                    label="posId (Momentum)"
                    value={draft.blumonPosId}
                    placeholder="376"
                    onChange={(v) => patch('blumonPosId', v)}
                  />
                  <TextField
                    id="me-blumid"
                    label="Merchant ID de Blumon"
                    value={draft.blumonMerchantId}
                    onChange={(v) => patch('blumonMerchantId', v)}
                  />
                  <div>
                    <span className={labelCls}>Ambiente</span>
                    <Combobox
                      value={draft.blumonEnvironment}
                      onChange={(v) => patch('blumonEnvironment', v)}
                      options={[
                        {
                          value: 'PRODUCTION',
                          label: 'Producción',
                          description: 'Cobra de verdad',
                        },
                        { value: 'SANDBOX', label: 'Sandbox', description: 'Pruebas' },
                      ]}
                      placeholder="Sin ambiente"
                      ariaLabel="Ambiente Blumon"
                    />
                  </div>
                </Section>
              )}

              {kind === 'angelpay' && (
                <Section title="Datos AngelPay">
                  <TextField
                    id="me-afil"
                    label="Afiliación"
                    value={draft.angelpayAffiliation}
                    placeholder="9814275"
                    onChange={(v) => patch('angelpayAffiliation', v)}
                  />
                  <TextField
                    id="me-apname"
                    label="Nombre del comercio en AngelPay"
                    value={draft.angelpayMerchantName}
                    onChange={(v) => patch('angelpayMerchantName', v)}
                  />
                  <p className="text-[11.5px] text-[var(--ink-faint)]">
                    Son la copia que se muestra aquí. La verdad la tiene AngelPay: si allá cambia el
                    nombre o la afiliación, esto no se entera solo.
                  </p>
                </Section>
              )}

              <Section title="Banco">
                <TextField
                  id="me-bank"
                  label="Banco"
                  value={draft.bankName}
                  placeholder="BBVA"
                  onChange={(v) => patch('bankName', v)}
                />
                <TextField
                  id="me-clabe"
                  label="CLABE (18 dígitos)"
                  value={draft.clabeNumber}
                  onChange={(v) => patch('clabeNumber', v)}
                />
                <TextField
                  id="me-holder"
                  label="Titular"
                  value={draft.accountHolder}
                  onChange={(v) => patch('accountHolder', v)}
                />
              </Section>

              <Section
                title="Credenciales"
                hint="Déjalas en blanco para no cambiarlas. Se mezclan con las que ya existen."
              >
                {kind !== 'angelpay' && (
                  <TextField
                    id="me-cred-mid"
                    label="merchantId"
                    value={draft.credMerchantId}
                    onChange={(v) => patch('credMerchantId', v)}
                  />
                )}
                <TextField
                  id="me-cred-key"
                  label="apiKey"
                  type="password"
                  value={draft.credApiKey}
                  onChange={(v) => patch('credApiKey', v)}
                />
              </Section>

              <Section
                title="Tasas de costo del proveedor"
                hint="Lo que el proveedor te cobra a ti. El margen se sigue viendo en la tarjeta Economía."
              >
                <CardRatesInput
                  value={draft.rates}
                  onChange={(r) => patch('rates', r)}
                  idPrefix="me-rate"
                />
                <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={draft.ratesIncludeTax}
                    onChange={(e) => patch('ratesIncludeTax', e.target.checked)}
                  />
                  Las tasas ya incluyen IVA
                </label>
              </Section>

              <Section title="Liquidación">
                {CARD_TYPES.map((card) => (
                  <div key={card} className="flex items-center gap-3">
                    <span className="w-24 text-[13px] text-[var(--ink-muted)]">
                      {humanizeCardType(card)}
                    </span>
                    <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-faint)]">
                      D+
                      <input
                        className={numCls}
                        inputMode="numeric"
                        value={String(draft.settlementDays[card])}
                        aria-label={`Días ${humanizeCardType(card)}`}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            settlementDays: {
                              ...d.settlementDays,
                              [card]: Math.max(0, parseInt(e.target.value, 10) || 0),
                            } as Record<CardType, number>,
                          }))
                        }
                      />
                    </label>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-40">
                    <Combobox
                      value={draft.settlementDayType}
                      onChange={(v) => patch('settlementDayType', v as SettlementDayType)}
                      options={[
                        { value: 'BUSINESS_DAYS', label: 'Hábiles' },
                        { value: 'CALENDAR_DAYS', label: 'Naturales' },
                      ]}
                      ariaLabel="Tipo de días de liquidación"
                    />
                  </div>
                  <label
                    htmlFor="me-cutoff"
                    className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]"
                  >
                    Corte
                    <input
                      id="me-cutoff"
                      className={numCls.replace('w-16', 'w-24')}
                      value={draft.cutoffTime}
                      placeholder="23:00"
                      onChange={(e) => patch('cutoffTime', e.target.value)}
                    />
                  </label>
                  <Badge tone="muted" size="sm">
                    {settlements[0]?.cutoffTimezone || 'America/Mexico_City'}
                  </Badge>
                </div>
              </Section>

              {error && (
                <p className="text-[13px] text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-[8px] border border-[var(--line)] p-3">
      <legend className="px-1 text-[12px] font-medium text-[var(--ink-muted)]">{title}</legend>
      {hint && <p className="text-[11.5px] text-[var(--ink-faint)]">{hint}</p>}
      {children}
    </fieldset>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={inputCls}
        type={type}
        autoComplete={type === 'password' ? 'off' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
