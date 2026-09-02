import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Checkbox } from '@/shared/ui/Checkbox'
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
import { formatDateTime } from '@/shared/lib/datetime'
import { maskFingerprint } from './identifiers'
import { formatMinorUnits } from './money'
import {
  EXCEPTION_REASON_LABEL,
  MANUAL_SPEI_STATUS_LABEL,
  type ManualSpeiCaseStatus,
  type ManualSpeiEvidence,
} from './types'
import { useManualSpeiActions, useManualSpeiCase } from './use-commercial-billing'

const STATUS_TONE: Record<ManualSpeiCaseStatus, 'muted' | 'success' | 'warn' | 'danger' | 'info'> =
  {
    PENDING_REVIEW: 'warn',
    AWAITING_APPROVAL: 'info',
    READY_TO_RECONCILE: 'warn',
    RECONCILED: 'success',
    REJECTED: 'danger',
  }

function EvidenceCard({
  evidence,
  canReview,
  onReview,
  onOpen,
  reviewing,
  opening,
}: {
  evidence: ManualSpeiEvidence
  canReview: boolean
  onReview: (evidenceId: string, action: 'ACCEPT' | 'REJECT', reason: string | null) => void
  onOpen: (evidenceId: string) => void
  reviewing: boolean
  opening: boolean
}) {
  const [reason, setReason] = useState('')
  const latestReview = evidence.reviews.at(-1)

  return (
    <article className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Evidencia #{evidence.sequence}
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] text-[var(--ink-faint)]">
              {evidence.mimeType} · {(evidence.sizeBytes / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
        {latestReview && (
          <Badge tone={latestReview.action === 'ACCEPT' ? 'success' : 'danger'}>
            {latestReview.action === 'ACCEPT' ? 'Aceptada' : 'Rechazada'}
          </Badge>
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-[11.5px] text-[var(--ink-muted)] sm:grid-cols-2">
        <div>
          <dt className="text-[var(--ink-faint)]">Cargada por</dt>
          <dd className="mt-0.5 truncate font-mono">{evidence.uploadedById}</dd>
        </div>
        <div>
          <dt className="text-[var(--ink-faint)]">Fecha</dt>
          <dd className="mt-0.5">{formatDateTime(evidence.createdAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[var(--ink-faint)]">SHA-256</dt>
          <dd className="mt-0.5 truncate font-mono" title={evidence.contentSha256}>
            {maskFingerprint(evidence.contentSha256)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Abrir evidencia #${evidence.sequence}`}
          disabled={opening}
          onClick={() => onOpen(evidence.id)}
        >
          {opening ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          )}
          Abrir evidencia
        </Button>
      </div>

      {latestReview?.reason && (
        <p className="mt-3 rounded-[6px] bg-[var(--danger-faint)] px-3 py-2 text-[11.5px] text-[var(--danger)]">
          {latestReview.reason}
        </p>
      )}

      {canReview && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <label
            className="text-[11.5px] font-medium text-[var(--ink-muted)]"
            htmlFor={`reason-${evidence.id}`}
          >
            Motivo si se rechaza
          </label>
          <textarea
            id={`reason-${evidence.id}`}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Describe la inconsistencia encontrada…"
            className="mt-1.5 min-h-20 w-full resize-y rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={reviewing || reason.trim().length === 0}
              onClick={() => onReview(evidence.id, 'REJECT', reason.trim())}
            >
              Rechazar evidencia
            </Button>
            <Button
              size="sm"
              disabled={reviewing}
              onClick={() => onReview(evidence.id, 'ACCEPT', null)}
            >
              Aceptar evidencia
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}

export function ManualSpeiCaseDrawer({
  caseId,
  open,
  onOpenChange,
}: {
  caseId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const query = useManualSpeiCase(caseId)
  const { reviewEvidence, openEvidence, approveCase } = useManualSpeiActions()
  const [confirmed, setConfirmed] = useState(false)
  const detail = query.data
  const canApprove =
    detail?.status === 'AWAITING_APPROVAL' || detail?.status === 'READY_TO_RECONCILE'

  const handleReview = (evidenceId: string, action: 'ACCEPT' | 'REJECT', reason: string | null) => {
    if (!detail) return
    reviewEvidence.mutate({
      caseId: detail.id,
      evidenceId,
      organizationId: detail.organizationId,
      venueId: detail.venueId,
      action,
      reason,
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Revisión de SPEI</DrawerTitle>
          <DrawerSubtitle>{caseId ? `Caso ${caseId}` : 'Detalle del caso'}</DrawerSubtitle>
        </DrawerHeader>

        <DrawerBody className="space-y-5">
          {query.isLoading && (
            <div
              role="status"
              aria-label="Cargando expediente"
              className="space-y-3 py-2 motion-safe:animate-pulse"
            >
              <div className="h-28 rounded-[8px] bg-[var(--canvas-sunken)]" />
              <div className="h-3 w-32 rounded-full bg-[var(--line-strong)]" />
              <div className="h-36 rounded-[8px] bg-[var(--canvas-sunken)]" />
            </div>
          )}
          {query.isError && (
            <QueryError
              error={query.error}
              context="cargar el caso SPEI"
              onRetry={() => query.refetch()}
              isRetrying={query.isFetching}
            />
          )}

          {detail && (
            <>
              <section className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas-sunken)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Importe observado</p>
                    <p className="mt-1.5 font-display text-[27px] font-semibold tabular text-[var(--ink)]">
                      {formatMinorUnits(detail.observedAmountMinor, detail.currency)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[detail.status]}>
                    {MANUAL_SPEI_STATUS_LABEL[detail.status]}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[var(--ink-faint)]">Referencia bancaria</dt>
                    <dd className="mt-0.5 font-mono text-[var(--ink)]">
                      {detail.bankReference ?? 'Sin referencia'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-faint)]">Fingerprint receptor</dt>
                    <dd
                      className="mt-0.5 font-mono text-[var(--ink)]"
                      title={detail.receivingAccountFingerprint}
                    >
                      {maskFingerprint(detail.receivingAccountFingerprint)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-faint)]">Observado</dt>
                    <dd className="mt-0.5 text-[var(--ink)]">
                      {formatDateTime(detail.observedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--ink-faint)]">Aprobaciones</dt>
                    <dd className="mt-0.5 font-mono text-[var(--ink)]">
                      {detail.approvalCount} de {detail.requiredApprovals}
                    </dd>
                  </div>
                </dl>
              </section>

              {detail.exceptionReasons.length > 0 && (
                <section aria-labelledby="spei-exceptions">
                  <h2 id="spei-exceptions" className="eyebrow flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Excepciones detectadas
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {detail.exceptionReasons.map((reason) => (
                      <Badge key={reason} tone="warn">
                        {EXCEPTION_REASON_LABEL[reason] ?? reason}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              <section aria-labelledby="spei-evidence">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <h2 id="spei-evidence" className="eyebrow">
                    Evidencia y revisiones
                  </h2>
                  <span className="font-mono text-[10.5px] text-[var(--ink-faint)]">
                    {detail.evidence.length} archivo(s)
                  </span>
                </div>
                <div className="space-y-2.5">
                  {detail.evidence.map((evidence) => (
                    <EvidenceCard
                      key={evidence.id}
                      evidence={evidence}
                      canReview={
                        detail.status === 'PENDING_REVIEW' && evidence.reviews.length === 0
                      }
                      reviewing={reviewEvidence.isPending}
                      opening={openEvidence.isPending}
                      onReview={handleReview}
                      onOpen={(evidenceId) =>
                        openEvidence.mutate({
                          evidenceId,
                          organizationId: detail.organizationId,
                          venueId: detail.venueId,
                        })
                      }
                    />
                  ))}
                </div>
              </section>

              <section aria-labelledby="spei-approvals">
                <h2 id="spei-approvals" className="eyebrow">
                  Historial de aprobación
                </h2>
                {detail.approvals.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
                    Sin aprobaciones todavía.
                  </p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {detail.approvals.map((approval, index) => (
                      <li
                        key={approval.id}
                        className="flex items-start gap-2.5 rounded-[6px] border border-[var(--line)] px-3 py-2.5"
                      >
                        <CheckCircle2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[var(--ink)]">
                            Aprobación {index + 1} ·{' '}
                            <span className="font-mono">{approval.actorId}</span>
                          </p>
                          <p className="mt-0.5 text-[10.5px] text-[var(--ink-faint)]">
                            {formatDateTime(approval.createdAt)} · política{' '}
                            {approval.policyVersionId}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {canApprove && (
                <section className="rounded-[8px] border border-[var(--warn)]/35 bg-[var(--warn-faint)] p-4">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warn)]"
                      aria-hidden
                    />
                    <div>
                      <p className="text-[12.5px] font-semibold text-[var(--ink)]">
                        Acción financiera
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
                        Si esta aprobación completa el umbral, Server conciliará el cobro y emitirá
                        el recibo.
                      </p>
                    </div>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12px] text-[var(--ink)]">
                    <Checkbox
                      checked={confirmed}
                      disabled={approveCase.isSuccess}
                      onCheckedChange={(value) => setConfirmed(value === true)}
                      aria-label="Confirmo que revisé importe, referencia y evidencia"
                      className="mt-0.5"
                    />
                    <span>Confirmo que revisé importe, referencia y evidencia</span>
                  </label>
                </section>
              )}
            </>
          )}
        </DrawerBody>

        {detail && canApprove && (
          <DrawerFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              disabled={!confirmed || approveCase.isPending || approveCase.isSuccess}
              onClick={() =>
                approveCase.mutate({
                  caseId: detail.id,
                  organizationId: detail.organizationId,
                  venueId: detail.venueId,
                  confirm: true,
                })
              }
            >
              {approveCase.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {approveCase.isSuccess ? 'Aprobación registrada' : 'Registrar aprobación'}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  )
}
