import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
} from '@/shared/ui/Drawer'
import { PrivateDocumentPreview } from '@/shared/components/PrivateDocumentPreview'
import { QueryError } from '@/shared/components/QueryError'
import { DocumentRequestPagination } from '@/shared/components/DocumentRequestPagination'
import {
  DOCUMENT_REQUESTS_KEY,
  downloadLinkedDocument,
  previewLinkedDocument,
  getLinkedDocumentDetail,
  listVenueDocumentLinks,
  requestSummary,
} from '@/shared/lib/venue-document-requests'
import { formatDateTime, timezoneShort, DEFAULT_TIMEZONE } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'

export function VenueDocumentsSection({ venueId }: { venueId: string }) {
  const [page, setPage] = useState(1)
  const [linkId, setLinkId] = useState<string | null>(null)
  const query = useQuery({
    queryKey: [...DOCUMENT_REQUESTS_KEY, 'venues', venueId, page],
    queryFn: () => listVenueDocumentLinks(venueId, { page, pageSize: 10 }),
  })
  return (
    <section
      aria-label="Documentos de afiliación"
      className="space-y-4 border-t border-[var(--line)] pt-5"
    >
      <h2 className="text-lg font-semibold">Documentos de afiliación</h2>
      <p className="text-sm text-[var(--ink-muted)]">
        Entregas anexadas expresamente. Se conserva cada versión, aunque se renueve la liga pública.
      </p>
      {query.isError ? (
        <QueryError
          error={query.error}
          context="cargar documentos de afiliación"
          onRetry={() => query.refetch()}
        />
      ) : !query.data ? (
        <p role="status">Cargando expedientes…</p>
      ) : (
        <>
          {query.data.items.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {query.data.items.map((link) => (
                <li
                  key={link.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="break-words font-medium">
                      {link.businessName}{' '}
                      <Badge tone="muted">Versión {link.submissionVersion}</Badge>
                    </p>
                    <p className="text-[var(--ink-muted)]">{requestSummary(link)}</p>
                    <p className="tabular text-[var(--ink-muted)]">
                      Anexado ({timezoneShort(DEFAULT_TIMEZONE)}): {formatDateTime(link.linkedAt)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setLinkId(link.id)}
                    aria-label={`Ver expediente ${link.businessName} versión ${link.submissionVersion}`}
                  >
                    Ver expediente
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              No hay expedientes anexados. Vincula una entrega desde Solicitudes de documentos.
            </p>
          )}
          <DocumentRequestPagination
            page={page}
            pageSize={10}
            total={query.data.total}
            onChange={setPage}
            busy={query.isFetching}
          />
        </>
      )}
      <Drawer
        open={Boolean(linkId)}
        onOpenChange={(open) => {
          if (!open) setLinkId(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader onClose={() => setLinkId(null)}>
            <DrawerTitle>Expediente de afiliación</DrawerTitle>
            <DrawerSubtitle>Versión conservada · Acceso exclusivo superadmin</DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody>
            {linkId && <LinkedDocuments key={linkId} venueId={venueId} linkId={linkId} />}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </section>
  )
}
function LinkedDocuments({ venueId, linkId }: { venueId: string; linkId: string }) {
  const query = useQuery({
    queryKey: [...DOCUMENT_REQUESTS_KEY, 'venues', venueId, 'links', linkId],
    queryFn: () => getLinkedDocumentDetail(venueId, linkId),
  })
  const download = useMutation({
    mutationFn: (documentId: string) => downloadLinkedDocument(venueId, linkId, documentId),
    onSuccess: ({ url }) => {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.rel = 'noreferrer'
      anchor.download = ''
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    },
    onError: (error) => {
      const info = inspectApiError(error, 'descargar el documento')
      toast.error(info.title, { description: info.description })
    },
  })
  if (query.isError)
    return (
      <QueryError
        error={query.error}
        context="cargar la versión del expediente"
        onRetry={() => query.refetch()}
      />
    )
  if (!query.data) return <p role="status">Cargando versión…</p>
  const { request, link, documents } = query.data
  return (
    <div className="space-y-5 text-sm">
      <div className="space-y-2">
        <h3 className="break-words text-lg font-semibold">{request.businessName}</h3>
        <Badge tone="muted">Versión {link.submissionVersion}</Badge>
        <p>{requestSummary(link)}</p>
      </div>
      <dl className="space-y-3">
        {[
          ['Contacto', request.contactName],
          ['Correo', request.email],
          ['Teléfono', request.phone],
          [`Recibido (${timezoneShort(DEFAULT_TIMEZONE)})`, formatDateTime(request.submittedAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="label text-[var(--ink-muted)]">{label}</dt>
            <dd className="mt-1 break-words tabular">{value || '—'}</dd>
          </div>
        ))}
      </dl>
      <h3 className="text-base font-semibold">Documentos conservados</h3>
      {documents.length ? (
        <ul className="divide-y divide-[var(--line)]">
          {documents.map((document) => (
            <li key={document.id} className="space-y-2 py-3">
              <p className="break-all font-medium">{document.fileName}</p>
              <p className="tabular text-[var(--ink-muted)]">
                {document.mimeType} · {Math.ceil(document.sizeBytes / 1024)} KB
              </p>
              <div className="flex flex-wrap gap-2">
                <PrivateDocumentPreview
                  documentKey={`${venueId}/${linkId}/${document.id}`}
                  fileName={document.fileName}
                  requestPreview={() => previewLinkedDocument(venueId, linkId, document.id)}
                  onDownload={() => download.mutate(document.id)}
                  isDownloading={download.isPending}
                />
                <Button
                  variant="secondary"
                  disabled={download.isPending}
                  onClick={() => download.mutate(document.id)}
                  aria-label={`Descargar ${document.fileName}`}
                >
                  Descargar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[var(--ink-muted)]">Esta versión no contiene archivos conservados.</p>
      )}
    </div>
  )
}
