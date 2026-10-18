import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QueryError } from '@/shared/components/QueryError'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  getDocumentRequest,
  renewDocumentRequest,
  revokeDocumentRequest,
  downloadRequestDocument,
  type RequestLink,
} from './api'
import { RequestStatus } from './RequestStatus'
import { RequestLinkPanel } from './RequestLinkPanel'

export function DocumentRequestDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const client = useQueryClient()
  const [confirmation, setConfirmation] = useState<'renew' | 'revoke' | null>(null)
  const [link, setLink] = useState<RequestLink | null>(null)
  const query = useQuery({
    queryKey: ['superadmin', 'document-requests', id],
    queryFn: () => getDocumentRequest(id),
    enabled: Boolean(id),
  })
  function onError(error: unknown) {
    const { title, description } = inspectApiError(error, 'actualizar la solicitud')
    toast.error(title, { description })
  }
  async function refresh() {
    setConfirmation(null)
    await client.invalidateQueries({ queryKey: ['superadmin', 'document-requests'] })
  }
  const renew = useMutation({
    mutationFn: () => renewDocumentRequest(id),
    onSuccess: async (data) => {
      setLink(data)
      await refresh()
    },
    onError,
  })
  const revoke = useMutation({
    mutationFn: () => revokeDocumentRequest(id),
    onSuccess: async () => {
      setLink(null)
      await refresh()
    },
    onError,
  })
  const download = useMutation({
    mutationFn: (documentId: string) => downloadRequestDocument(id, documentId),
    onSuccess: ({ url }) => {
      // Storage firma Content-Disposition attachment; navegación normal evita bloquear popups tras await.
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.rel = 'noreferrer'
      anchor.download = ''
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    },
    onError: (error) => {
      const { title, description } = inspectApiError(error, 'descargar el documento')
      toast.error(title, { description })
    },
  })
  const busy = renew.isPending || revoke.isPending
  const request = query.data?.request
  return (
    <div className="mx-auto max-w-screen-lg space-y-7 px-4 py-8 sm:px-6 lg:px-10">
      <Link to="/document-requests" className={buttonVariants({ variant: 'ghost' })}>
        ← Solicitudes de documentos
      </Link>
      {query.isError ? (
        <QueryError
          error={query.error}
          context="cargar la solicitud"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : !request ? (
        <p role="status">Cargando solicitud…</p>
      ) : (
        <>
          <header>
            <p className="eyebrow text-[var(--ink-muted)]">Documentos de afiliación</p>
            <h1 className="mt-2 break-words text-3xl font-semibold">{request.businessName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RequestStatus request={request} />
              <span className="text-sm text-[var(--ink-muted)]">
                {request.provider === 'ANGELPAY' ? 'AngelPay' : 'Blumon'} · Persona{' '}
                {request.entityType === 'PERSONA_FISICA' ? 'física' : 'moral'}
              </span>
            </div>
          </header>
          <section aria-label="Contacto y fechas" className="border-y border-[var(--line)] py-5">
            <h2 className="text-lg font-semibold">Contacto</h2>
            {request.contactName || request.email || request.phone ? (
              <dl className="mt-4 grid gap-5 sm:grid-cols-3">
                <div>
                  <dt className="label text-[var(--ink-muted)]">Nombre</dt>
                  <dd className="mt-1 break-words text-sm">{request.contactName ?? '—'}</dd>
                </div>
                <div>
                  <dt className="label text-[var(--ink-muted)]">Correo</dt>
                  <dd className="mt-1 break-all text-sm">{request.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="label text-[var(--ink-muted)]">Teléfono</dt>
                  <dd className="mt-1 tabular text-sm">{request.phone ?? '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">Contacto pendiente de envío</p>
            )}
            <dl className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ['Creada', request.createdAt],
                ['Vence', request.expiresAt],
                ['Recibida', request.submittedAt],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="label text-[var(--ink-muted)]">
                    {label} ({timezoneShort(DEFAULT_TIMEZONE)})
                  </dt>
                  <dd className="mt-1 tabular text-sm">{formatDateTime(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-label="Documentos recibidos">
            <h2 className="text-lg font-semibold">Documentos recibidos</h2>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              La descarga está disponible sólo para superadmin. Recibir documentos no aprueba la
              afiliación.
            </p>
            {query.data!.documents.length === 0 ? (
              <p className="mt-5 text-sm text-[var(--ink-muted)]">
                Todavía no hay archivos. Aparecerán conforme el cliente los guarde.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {query.data!.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-all text-sm font-medium">{document.fileName}</p>
                      <p className="mt-1 tabular text-sm text-[var(--ink-muted)]">
                        {document.mimeType} · {Math.ceil(document.sizeBytes / 1024)} KB
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={download.isPending}
                      onClick={() => download.mutate(document.id)}
                      aria-label={`Descargar ${document.fileName}`}
                    >
                      Descargar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {link?.request.id === id && request.status === 'DRAFT' ? (
            <RequestLinkPanel uploadUrl={link.uploadUrl} />
          ) : null}
          <section
            aria-label="Avisos por correo"
            className="space-y-3 border-t border-[var(--line)] pt-5"
          >
            <h2 className="text-lg font-semibold">Avisos por correo</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              El expediente se conserva aunque un correo falle.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {(['onboarding', 'daniel'] as const).map((recipient) => {
                const status = request.notification?.[recipient] ?? 'NONE'
                const labels = {
                  NONE: 'Sin envío',
                  PENDING: 'Pendiente',
                  SENT: 'Enviado',
                  FAILED: 'Falló',
                  UNKNOWN: 'Por confirmar',
                }
                return (
                  <div key={recipient}>
                    <dt className="label text-[var(--ink-muted)]">{recipient}@avoqado.io</dt>
                    <dd className="mt-2">
                      <Badge
                        tone={
                          status === 'SENT'
                            ? 'success'
                            : status === 'FAILED' || status === 'PENDING' || status === 'UNKNOWN'
                              ? 'warn'
                              : 'muted'
                        }
                      >
                        {labels[status]}
                      </Badge>
                    </dd>
                  </div>
                )
              })}
            </dl>
            {request.notification?.nextAttemptAt ? (
              <p className="tabular text-sm text-[var(--ink-muted)]">
                Próximo intento ({timezoneShort(DEFAULT_TIMEZONE)}):{' '}
                {formatDateTime(request.notification.nextAttemptAt)}
              </p>
            ) : null}
          </section>
          <section
            className="space-y-4 border-t border-[var(--line)] pt-5"
            aria-label="Gestionar liga"
          >
            <h2 className="text-lg font-semibold">Liga de entrega</h2>
            <p className="text-sm text-[var(--ink-muted)]">
              Renovar conserva los archivos y permite corregir la entrega. La liga anterior deja de
              funcionar. Revocar impide nuevas entregas.
            </p>
            {confirmation ? (
              <div className="space-y-3" role="group" aria-label="Confirmar cambio de liga">
                <p className="text-sm">
                  {confirmation === 'renew'
                    ? 'Se invalidará la liga anterior y se reabrirá la solicitud durante 14 días.'
                    : 'El cliente ya no podrá usar esta liga. Los documentos recibidos se conservarán.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    variant={confirmation === 'revoke' ? 'danger' : 'primary'}
                    onClick={() => (confirmation === 'renew' ? renew.mutate() : revoke.mutate())}
                  >
                    {confirmation === 'renew' ? 'Confirmar renovación' : 'Confirmar revocación'}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirmation('renew')}
                >
                  Renovar liga
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || request.status === 'REVOKED'}
                  onClick={() => setConfirmation('revoke')}
                >
                  Revocar liga
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
