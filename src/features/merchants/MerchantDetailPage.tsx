import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  useMerchant,
  useMerchantEconomicsData,
  useSetTerminalServes,
  useToggleMerchant,
} from './use-merchants'
import { EditEconomicsDrawer } from './EditEconomicsDrawer'
import { PricingWizardDrawer, type PricingWizardResult } from './PricingWizardDrawer'
import { draftFromInput } from './revenue-share'
import { MerchantIdentityDrawer } from './MerchantIdentityDrawer'
import { DeleteMerchantDialog } from './DeleteMerchantDialog'
import { AssignTerminalDrawer } from './AssignTerminalDrawer'
import { computeReadiness } from './readiness'
import { ReadinessStrip } from './ReadinessStrip'
import { MoneyFlow } from './MoneyFlow'
import { EconomicsTable } from './EconomicsTable'
import { VenueEconomicsSection } from './VenueEconomics'
import {
  activeTone,
  environmentTone,
  humanizeCardType,
  humanizeEnvironment,
  type AccountSlot,
} from './types'
import { EditVenuePricingDrawer } from './EditVenuePricingDrawer'
import { EditSettlementDrawer } from './EditSettlementDrawer'
import { RateCorrectionHistory } from './RateCorrectionHistory'

export function MerchantDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const merchantQ = useMerchant(id)
  const eco = useMerchantEconomicsData(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingEco, setEditingEco] = useState(false)
  const [editingSettlement, setEditingSettlement] = useState(false)
  const [pricingTarget, setPricingTarget] = useState<{
    venueId: string
    venueName: string
    slot: AccountSlot
  } | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [prefill, setPrefill] = useState<PricingWizardResult | null>(null)
  const [ecoPrefillOpen, setEcoPrefillOpen] = useState(false)
  const [pricingPrefillOpen, setPricingPrefillOpen] = useState(false)
  const toggleM = useToggleMerchant()
  const [assigning, setAssigning] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string; serialNumber: string } | null>(
    null,
  )
  const setServes = useSetTerminalServes(id ?? '')

  if (merchantQ.isError) {
    return (
      <Shell>
        <QueryError
          error={merchantQ.error}
          context="cargar la cuenta"
          onRetry={() => merchantQ.refetch()}
        />
      </Shell>
    )
  }
  if (merchantQ.isLoading) {
    return (
      <Shell>
        <p className="text-[var(--ink-faint)]">Cargando…</p>
      </Shell>
    )
  }
  const m = merchantQ.data
  if (!m) {
    return (
      <Shell>
        <p className="text-[var(--ink-muted)]">Esta cuenta no existe o fue eliminada.</p>
      </Shell>
    )
  }

  const readiness = computeReadiness(m, { hasSettlement: eco.hasSettlement })

  function doRemoveTerminal(terminalId: string) {
    setServes.mutate(
      { terminalId, serves: false },
      {
        onSuccess: () => {
          toast.success('Terminal quitada')
          setRemoveTarget(null)
        },
        onError: (e) => {
          const i = inspectApiError(e, 'quitar la terminal')
          toast.error(i.title, { description: i.description })
          setRemoveTarget(null)
        },
      },
    )
  }

  function handleRemoveTerminal(t: { id: string; serialNumber: string; inherited: boolean }) {
    if (t.inherited) setRemoveTarget({ id: t.id, serialNumber: t.serialNumber })
    else doRemoveTerminal(t.id)
  }

  return (
    <Shell>
      <Link
        to="/merchants"
        className="inline-flex items-center gap-1 text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Merchants
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
              {m.displayName ?? m.alias ?? m.externalMerchantId}
            </h1>
            <Badge tone="muted" size="sm">
              {m.provider.name}
            </Badge>
            {m.blumonEnvironment && (
              <Badge tone={environmentTone(m.blumonEnvironment)} size="sm">
                {humanizeEnvironment(m.blumonEnvironment)}
              </Badge>
            )}
            <Badge tone={activeTone(m.active)} size="sm">
              {m.active ? 'Activa' : 'Inactiva'}
            </Badge>
          </div>
          <p className="text-[12.5px] tabular-nums text-[var(--ink-faint)]">
            ext {m.externalMerchantId}
            {m.blumonSerialNumber ? ` · serial ${m.blumonSerialNumber}` : ''}
            {m.blumonPosId ? ` · posId ${m.blumonPosId}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={toggleM.isPending}
            onClick={() =>
              toggleM.mutate(m.id, {
                onSuccess: () => toast.success(m.active ? 'Cuenta desactivada' : 'Cuenta activada'),
                onError: (err) => {
                  const i = inspectApiError(err, 'cambiar el estado de la cuenta')
                  toast.error(i.title, { description: i.description })
                },
              })
            }
          >
            {m.active ? 'Desactivar' : 'Activar'}
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
            Borrar
          </Button>
        </div>
      </header>

      <ReadinessStrip items={readiness} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div
          id="section-cost"
          className="scroll-mt-20 rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">Economía</h3>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setWizardOpen(true)}>
                Asistente
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingEco(true)}>
                Editar
              </Button>
            </div>
          </div>
          {eco.isError ? (
            <QueryError error={eco.error} context="cargar la economía" onRetry={eco.refetch} />
          ) : eco.economics ? (
            <MoneyFlow economics={eco.economics} cost={eco.cost} />
          ) : (
            <p className="text-[13px] text-[var(--ink-faint)]">
              Sin estructura de costos — configura el costo del proveedor para ver la economía.
            </p>
          )}
        </div>
        <div
          id="section-credentials"
          className="scroll-mt-20 rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5"
        >
          <h3 className="mb-3 text-[13px] font-semibold text-[var(--ink)]">
            Identidad &amp; banco
          </h3>
          <dl className="flex flex-col gap-1.5 text-[13px]">
            <Field label="Banco" value={m.bankName ?? '—'} />
            <Field label="CLABE" value={m.clabeNumber ?? '—'} />
            <Field label="Titular" value={m.accountHolder ?? '—'} />
            <Field label="Credenciales" value={m.hasCredentials ? 'Sí' : 'No'} />
          </dl>
        </div>
      </section>

      {eco.economics && (
        <Section title="Economía (por tarjeta)">
          <EconomicsTable economics={eco.economics} />
          {eco.economics.mode === 'aggregator' && (
            <p className="text-[12px] text-[var(--ink-faint)]">
              Sólo el tramo proveedor→agregador. El tramo agregador→venue depende del pricing de
              cada venue y se desglosa por venue más abajo.
            </p>
          )}
        </Section>
      )}

      <section id="section-settlement" className="scroll-mt-20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">Liquidación</h2>
          <Button size="sm" variant="ghost" onClick={() => setEditingSettlement(true)}>
            Editar
          </Button>
        </div>
        {eco.settlements.length === 0 ? (
          <Empty>Sin días de liquidación configurados.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {eco.settlements.map((s) => (
              <li
                key={s.id}
                className="flex justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <span className="text-[var(--ink-muted)]">{humanizeCardType(s.cardType)}</span>
                <span className="tabular-nums text-[var(--ink)]">
                  D+{s.settlementDays}{' '}
                  {s.settlementDayType === 'BUSINESS_DAYS' ? 'hábiles' : 'naturales'} · corte{' '}
                  {s.cutoffTime}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section id="section-slots" title={`Venues (${eco.venueConfigs.length})`}>
        <VenueEconomicsSection
          venueConfigs={eco.venueConfigs}
          cost={eco.cost}
          revenueShare={eco.revenueShare}
          onEditPricing={(vc) =>
            setPricingTarget({ venueId: vc.venueId, venueName: vc.venue.name, slot: vc.slot })
          }
        />
      </Section>

      <section id="section-terminals" className="scroll-mt-20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">
            Terminales ({m.terminals.length})
          </h2>
          <Button size="sm" variant="ghost" onClick={() => setAssigning(true)}>
            Asignar terminal
          </Button>
        </div>
        {m.terminals.length === 0 ? (
          <Empty>
            Ninguna terminal lo procesa todavía (ni asignada ni heredada del slot del venue).
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {m.terminals.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-[var(--ink)]">{t.serialNumber || t.id}</span>
                  <Badge tone="muted" size="sm">
                    {t.inherited ? 'heredada' : 'asignada'}
                  </Badge>
                </div>
                <IconButton
                  size="sm"
                  aria-label="Quitar terminal"
                  title="Quitar terminal"
                  disabled={setServes.isPending}
                  onClick={() => handleRemoveTerminal(t)}
                >
                  <Unlink className="h-3.5 w-3.5" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section id="section-rate-corrections" title="Correcciones de tasa">
        <RateCorrectionHistory merchantAccountId={m.id} venues={m.venues} />
      </Section>

      <p className="text-[11.5px] text-[var(--ink-faint)]">
        Actualizada {formatDateTime(m.updatedAt)}
      </p>

      <PricingWizardDrawer
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        cost={eco.cost}
        venues={eco.venueConfigs.map((c) => ({
          venueId: c.venueId,
          venueName: c.venue.name,
          slot: c.slot,
        }))}
        onPrefill={(r) => {
          setPrefill(r)
          setEcoPrefillOpen(true)
        }}
      />
      <EditEconomicsDrawer
        // El drawer está montado siempre; sin esta key, su estado se fija al cargar la
        // página (con lo guardado) y NO toma el `initialValues` del Asistente al abrirse.
        // Cambiar la key al entrar/salir del prefill fuerza un re-montaje que sí lo aplica.
        key={ecoPrefillOpen ? 'eco-prefill' : 'eco-manual'}
        open={editingEco || ecoPrefillOpen}
        onOpenChange={(o) => {
          if (o) {
            setEditingEco(true)
            return
          }
          setEditingEco(false)
          setEcoPrefillOpen(false)
        }}
        merchantId={m.id}
        cost={eco.cost}
        revenueShare={eco.revenueShare}
        initialValues={
          ecoPrefillOpen && prefill
            ? {
                rates: prefill.result.costInput.rates,
                includesTax: prefill.result.costInput.includesTax,
                revenueShare: draftFromInput(prefill.result.revenueShareInput),
              }
            : undefined
        }
        onSaved={() => {
          eco.refetch()
          if (ecoPrefillOpen) setPricingPrefillOpen(true)
        }}
      />
      {(pricingTarget || (pricingPrefillOpen && prefill)) && (
        <EditVenuePricingDrawer
          open={!!pricingTarget || pricingPrefillOpen}
          onOpenChange={(o) => {
            if (!o) {
              setPricingTarget(null)
              setPricingPrefillOpen(false)
              setPrefill(null)
            }
          }}
          venueId={pricingTarget?.venueId ?? prefill!.venueId}
          venueName={pricingTarget?.venueName ?? prefill!.venueName}
          slot={pricingTarget?.slot ?? prefill!.slot}
          cost={eco.cost}
          initialValues={
            pricingPrefillOpen && prefill
              ? {
                  rates: prefill.result.venuePricingInput.rates,
                  includesTax: prefill.result.venuePricingInput.includesTax,
                }
              : undefined
          }
          onSaved={eco.refetch}
        />
      )}
      <EditSettlementDrawer
        open={editingSettlement}
        onOpenChange={setEditingSettlement}
        merchantId={m.id}
        settlements={eco.settlements}
        onSaved={eco.refetch}
      />
      <MerchantIdentityDrawer open={editing} onOpenChange={setEditing} merchant={m} />
      <DeleteMerchantDialog
        open={deleting}
        onOpenChange={setDeleting}
        merchant={m}
        onDeleted={() => navigate('/merchants')}
      />
      <AssignTerminalDrawer open={assigning} onOpenChange={setAssigning} merchantId={m.id} />
      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => {
          if (!o) setRemoveTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar terminal heredada</DialogTitle>
            <DialogDescription>
              «{removeTarget?.serialNumber}» procesa este merchant por herencia del slot del venue.
              Al quitarla, la terminal queda restringida a los demás merchants del venue y deja de
              heredar cambios futuros del slot. ¿Continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={setServes.isPending}
              onClick={() => removeTarget && doRemoveTerminal(removeTarget.id)}
            >
              {setServes.isPending ? 'Quitando…' : 'Quitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</div>
}

function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={`flex flex-col gap-3${id ? ' scroll-mt-20' : ''}`}>
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ink-faint)]">{label}</dt>
      <dd className="tabular-nums text-[var(--ink)]">{value}</dd>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-[var(--ink-faint)]">{children}</p>
}
