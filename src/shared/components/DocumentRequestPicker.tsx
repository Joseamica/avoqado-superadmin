import { useState } from 'react'
import { useDebounced } from '@/shared/hooks/useDebounced'
import { useQuery } from '@tanstack/react-query'
import { Combobox } from '@/shared/ui/Combobox'
import { Button } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { QueryError } from './QueryError'
import { DocumentRequestPagination } from './DocumentRequestPagination'
import {
  DOCUMENT_REQUESTS_KEY,
  listDocumentRequests,
  requestSummary,
  type DocumentRequest,
} from '@/shared/lib/venue-document-requests'

export function DocumentRequestPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: DocumentRequest | null
  onChange: (request: DocumentRequest | null) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: [...DOCUMENT_REQUESTS_KEY, 'picker', { search: debouncedSearch, page }],
    queryFn: () =>
      listDocumentRequests({ search: debouncedSearch, page, pageSize: 10, status: 'SUBMITTED' }),
  })
  return (
    <div className="space-y-3">
      <Combobox
        ariaLabel="Expediente recibido"
        value={value?.id ?? ''}
        disabled={disabled}
        remote
        placeholder="Seleccionar expediente recibido"
        searchPlaceholder="Buscar negocio, contacto o correo…"
        emptyLabel={
          query.isFetching || search !== debouncedSearch
            ? 'Buscando expedientes…'
            : query.isError
              ? 'Consulta no disponible; reintenta debajo.'
              : 'No hay expedientes enviados con esta búsqueda.'
        }
        renderTriggerValue={() => value?.businessName}
        onSearchChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
        onChange={(id) => {
          const request = query.data?.items.find((item) => item.id === id)
          if (request) onChange(request)
        }}
        options={
          query.isError || query.isFetching || search !== debouncedSearch
            ? []
            : (query.data?.items ?? []).map((item) => ({
                value: item.id,
                label: item.businessName,
                description: `${requestSummary(item)} · Versión ${item.submissionVersion}`,
              }))
        }
        footer={
          query.data && !query.isError ? (
            <div className="px-3">
              <DocumentRequestPagination
                page={page}
                pageSize={10}
                total={query.data.total}
                busy={query.isFetching || search !== debouncedSearch}
                onChange={setPage}
              />
            </div>
          ) : null
        }
      />
      {query.isError && (
        <QueryError
          error={query.error}
          context="buscar expedientes recibidos"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      )}
      {value && (
        <div className="space-y-2 text-sm">
          <p className="font-medium break-words">
            {value.businessName} <Badge tone="muted">Versión {value.submissionVersion}</Badge>
          </p>
          <p className="text-[var(--ink-muted)]">{requestSummary(value)}</p>
          <p className="break-words">
            {[value.contactName, value.email, value.phone].filter(Boolean).join(' · ') ||
              'Sin contacto recibido'}
          </p>
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange(null)}>
            Quitar expediente
          </Button>
        </div>
      )}
    </div>
  )
}
