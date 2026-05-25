import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { QueryError } from '@/shared/components/QueryError'
import { formatDateTime } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'
import { useMerchant, useMerchantEconomicsData, useToggleMerchant } from './use-merchants'
import { EditEconomicsDrawer } from './EditEconomicsDrawer'
import { MerchantIdentityDrawer } from './MerchantIdentityDrawer'
import { DeleteMerchantDialog } from './DeleteMerchantDialog'
import { computeReadiness } from './readiness'
import { ReadinessStrip } from './ReadinessStrip'
import { MoneyFlow } from './MoneyFlow'
import { EconomicsTable } from './EconomicsTable'
import {
  activeTone,
  environmentTone,
  humanizeCardType,
  humanizeEnvironment,
  type AccountSlot,
} from './types'
import { EditVenuePricingDrawer } from './EditVenuePricingDrawer'

export function MerchantDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const merchantQ = useMerchant(id)
  const eco = useMerchantEconomicsData(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingEco, setEditingEco] = useState(false)
  const [pricingTarget, setPricingTarget] = useState<{
    venueId: string
    venueName: string
    slot: AccountSlot
  } | null>(null)
  const toggleM = useToggleMerchant()

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
        <div className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-[var(--ink)]">Economía</h3>
            <Button size="sm" variant="ghost" onClick={() => setEditingEco(true)}>
              Editar
            </Button>
          </div>
          {eco.isError ? (
            <QueryError error={eco.error} context="cargar la economía" onRetry={eco.refetch} />
          ) : eco.economics ? (
            <MoneyFlow economics={eco.economics} />
          ) : (
            <p className="text-[13px] text-[var(--ink-faint)]">
              Sin estructura de costos — configura el costo del proveedor para ver la economía.
            </p>
          )}
        </div>
        <div className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
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
        </Section>
      )}

      <Section title="Liquidación">
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
      </Section>

      <Section title={`Venues (${eco.venueConfigs.length})`}>
        {eco.venueConfigs.length === 0 ? (
          <Empty>No está asignada a ningún venue.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {eco.venueConfigs.map((vc) => (
              <li
                key={vc.venueId}
                className="flex items-center justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Link to={`/venues/${vc.venueId}`} className="text-[var(--ink)] hover:underline">
                    {vc.venue.name}
                  </Link>
                  <Badge tone="muted" size="sm">
                    {vc.slot}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setPricingTarget({
                      venueId: vc.venueId,
                      venueName: vc.venue.name,
                      slot: vc.slot,
                    })
                  }
                >
                  Editar pricing
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Terminales (${m.terminals.length})`}>
        {m.terminals.length === 0 ? (
          <Empty>Sin terminales asignadas.</Empty>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {m.terminals.map((t) => (
              <li
                key={t.id}
                className="flex justify-between border-b border-[var(--line)] py-1.5 last:border-0"
              >
                <span className="tabular-nums text-[var(--ink)]">{t.serialNumber || t.id}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-[11.5px] text-[var(--ink-faint)]">
        Actualizada {formatDateTime(m.updatedAt)}
      </p>

      <EditEconomicsDrawer
        open={editingEco}
        onOpenChange={setEditingEco}
        merchantId={m.id}
        cost={eco.cost}
        revenueShare={eco.revenueShare}
        onSaved={eco.refetch}
      />
      {pricingTarget && (
        <EditVenuePricingDrawer
          open={!!pricingTarget}
          onOpenChange={(o) => {
            if (!o) setPricingTarget(null)
          }}
          venueId={pricingTarget.venueId}
          venueName={pricingTarget.venueName}
          slot={pricingTarget.slot}
          cost={eco.cost}
          onSaved={eco.refetch}
        />
      )}
      <MerchantIdentityDrawer open={editing} onOpenChange={setEditing} merchant={m} />
      <DeleteMerchantDialog
        open={deleting}
        onOpenChange={setDeleting}
        merchant={m}
        onDeleted={() => navigate('/merchants')}
      />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
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
