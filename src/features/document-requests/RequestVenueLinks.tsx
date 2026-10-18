import { useState } from 'react'
import { useDebounced } from '@/shared/hooks/useDebounced'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox } from '@/shared/ui/Combobox'
import { QueryError } from '@/shared/components/QueryError'
import { DocumentRequestPagination } from '@/shared/components/DocumentRequestPagination'
import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  DOCUMENT_REQUESTS_KEY,
  linkRequestToVenue,
  listRequestVenueLinks,
  listVenueDocumentOptions,
  type DocumentRequest,
  type VenueDocumentOption,
} from '@/shared/lib/venue-document-requests'

export function RequestVenueLinks({ request }: { request: DocumentRequest }) {
  const [page, setPage] = useState(1)
  const [choosing, setChoosing] = useState(false)
  const query = useQuery({
    queryKey: [...DOCUMENT_REQUESTS_KEY, request.id, 'venue-links', page],
    queryFn: () => listRequestVenueLinks(request.id, { page, pageSize: 10 }),
  })
  return (
    <section
      aria-label="Venues vinculados"
      className="space-y-4 border-t border-[var(--line)] pt-5"
    >
      <h2 className="text-lg font-semibold">Venues vinculados</h2>
      <p className="text-sm text-[var(--ink-muted)]">
        Cada vínculo conserva la entrega de esa versión. Una entrega nueva se anexa expresamente;
        KYC y cobros se revisan por separado.
      </p>
      {request.status === 'SUBMITTED' && (
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/venues/new?documentRequest=${encodeURIComponent(request.id)}`}
            className={buttonVariants({ size: 'lg' })}
          >
            Crear venue
          </Link>
          <Button
            variant="secondary"
            onClick={() => setChoosing(!choosing)}
            aria-expanded={choosing}
          >
            Vincular a venue existente
          </Button>
        </div>
      )}
      {choosing && request.status === 'SUBMITTED' && (
        <ExistingVenueLinker
          key={`${request.id}:${request.submissionVersion}`}
          request={request}
          onDone={() => setChoosing(false)}
        />
      )}
      {query.isError ? (
        <QueryError
          error={query.error}
          context="cargar venues vinculados"
          onRetry={() => query.refetch()}
        />
      ) : !query.data ? (
        <p role="status">Cargando vínculos…</p>
      ) : (
        <>
          {query.data.items.length ? (
            <ul className="divide-y divide-[var(--line)]">
              {query.data.items.map((link) => (
                <li key={link.id} className="py-3 text-sm">
                  <Link className="underline underline-offset-2" to={`/venues/${link.venue.id}`}>
                    {link.venue.name}
                  </Link>
                  <p className="mt-1 break-words text-[var(--ink-muted)]">
                    {link.venue.organizationName} · Versión {link.submissionVersion}
                  </p>
                  <p className="mt-1 tabular text-[var(--ink-muted)]">
                    Vinculado ({timezoneShort(DEFAULT_TIMEZONE)}): {formatDateTime(link.linkedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              Este expediente todavía no está anexado a un venue.
            </p>
          )}
          <DocumentRequestPagination
            page={page}
            pageSize={10}
            total={query.data.total}
            onChange={setPage}
            busy={query.isFetching}
            noun="vínculos"
          />
        </>
      )}
    </section>
  )
}

function ExistingVenueLinker({
  request,
  onDone,
}: {
  request: DocumentRequest
  onDone: () => void
}) {
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)
  const [venue, setVenue] = useState<VenueDocumentOption | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const options = useQuery({
    queryKey: [...DOCUMENT_REQUESTS_KEY, 'venue-options', { search: debouncedSearch, page }],
    queryFn: () => listVenueDocumentOptions({ search: debouncedSearch, page, pageSize: 10 }),
  })
  const mutation = useMutation({
    mutationFn: () => {
      if (!venue || !confirmed) throw new Error('Confirma el negocio antes de vincular.')
      return linkRequestToVenue(request.id, {
        venueId: venue.id,
        submissionVersion: request.submissionVersion,
        confirmed: true,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: DOCUMENT_REQUESTS_KEY }),
        client.invalidateQueries({ queryKey: ['superadmin', 'venues'] }),
        client.invalidateQueries({ queryKey: ['superadmin', 'activity-log'] }),
      ])
      toast.success('Expediente vinculado')
      onDone()
    },
    onError: (error) => {
      const info = inspectApiError(error, 'vincular el expediente')
      toast.error(info.title, { description: info.description })
    },
  })
  return (
    <div
      role="group"
      aria-label="Vincular expediente a venue"
      className="space-y-4 border-y border-[var(--line)] py-4"
    >
      <Combobox
        ariaLabel="Venue existente"
        value={venue?.id ?? ''}
        remote
        disabled={mutation.isPending}
        placeholder="Seleccionar venue"
        searchPlaceholder="Buscar venue u organización…"
        renderTriggerValue={() => (venue ? `${venue.name} · ${venue.organizationName}` : '')}
        onSearchChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
        onChange={(id) => {
          setVenue(options.data?.items.find((item) => item.id === id) ?? null)
          setConfirmed(false)
        }}
        emptyLabel={
          options.isFetching || search !== debouncedSearch
            ? 'Buscando venues…'
            : options.isError
              ? 'Consulta no disponible; reintenta debajo.'
              : 'No hay venues con esta búsqueda.'
        }
        options={
          options.isError || options.isFetching || search !== debouncedSearch
            ? []
            : (options.data?.items ?? []).map((item) => ({
                value: item.id,
                label: item.name,
                description: item.organizationName,
              }))
        }
        footer={
          options.data && !options.isError ? (
            <div className="px-3">
              <DocumentRequestPagination
                page={page}
                pageSize={10}
                total={options.data.total}
                onChange={setPage}
                busy={options.isFetching || search !== debouncedSearch}
                noun="venues"
              />
            </div>
          ) : null
        }
      />
      {options.isError && (
        <QueryError
          error={options.error}
          context="buscar venues"
          onRetry={() => options.refetch()}
        />
      )}
      {venue && (
        <p className="break-words text-sm">
          {request.businessName} · Versión {request.submissionVersion} → {venue.name} ·{' '}
          {venue.organizationName}
        </p>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox
          checked={confirmed}
          disabled={!venue || mutation.isPending}
          onCheckedChange={(next) => setConfirmed(next === true)}
        />
        Confirmo que esta versión del expediente corresponde a este venue y su organización.
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          disabled={!venue || !confirmed || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Vinculando…' : 'Confirmar vínculo'}
        </Button>
        <Button variant="secondary" disabled={mutation.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
