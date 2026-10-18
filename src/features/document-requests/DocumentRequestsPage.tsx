import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { useDebounced } from '@/shared/hooks/useDebounced'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { Field } from '@/shared/ui/Field'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
} from '@/shared/ui/Drawer'
import { DEFAULT_TIMEZONE, formatDateTime, timezoneShort } from '@/shared/lib/datetime'
import { inspectApiError } from '@/shared/lib/api-error'
import {
  createDocumentRequest,
  listDocumentRequests,
  type DocumentRequest,
  type DocumentProvider,
  type DocumentEntityType,
} from './api'
import { RequestStatus } from './RequestStatus'
import { RequestLinkPanel } from './RequestLinkPanel'

const columns: ColumnDef<DocumentRequest, unknown>[] = [
  {
    id: 'business',
    header: 'Negocio',
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        className="font-medium underline-offset-4 hover:underline focus-visible:underline"
        to={`/document-requests/${row.original.id}`}
      >
        {row.original.businessName}
      </Link>
    ),
  },
  {
    id: 'provider',
    header: 'Procesador',
    enableSorting: false,
    cell: ({ row }) => (row.original.provider === 'ANGELPAY' ? 'AngelPay' : 'Blumon'),
  },
  {
    id: 'entity',
    header: 'Persona',
    enableSorting: false,
    cell: ({ row }) => (row.original.entityType === 'PERSONA_FISICA' ? 'Física' : 'Moral'),
  },
  {
    id: 'status',
    header: 'Estado',
    enableSorting: false,
    cell: ({ row }) => <RequestStatus request={row.original} />,
  },
  {
    id: 'created',
    header: `Creada (${timezoneShort(DEFAULT_TIMEZONE)})`,
    enableSorting: false,
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.createdAt)}</span>,
  },
  {
    id: 'expires',
    header: `Vence (${timezoneShort(DEFAULT_TIMEZONE)})`,
    enableSorting: false,
    cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.expiresAt)}</span>,
  },
]

export function DocumentRequestsPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const debouncedSearch = useDebounced(search)
  const query = useQuery({
    queryKey: ['superadmin', 'document-requests', { page, search: debouncedSearch, status }],
    queryFn: () => listDocumentRequests({ page, pageSize: 25, search: debouncedSearch, status }),
  })
  return (
    <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-8 sm:px-6 lg:px-10 [&_th]:text-[var(--ink-muted)] [&_footer]:text-[var(--ink-muted)]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-[var(--ink-muted)]">Onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold">Documentos de afiliación</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Recibe documentos de prospectos, aunque todavía no tengan una cuenta en Avoqado.
          </p>
        </div>
        <Button className="h-11 shrink-0" onClick={() => setCreating(true)}>
          Crear liga
        </Button>
      </header>
      {query.isError ? (
        <QueryError
          error={query.error}
          context="cargar solicitudes de documentos"
          onRetry={() => query.refetch()}
          isRetrying={query.isFetching}
        />
      ) : null}
      <DataTable
        data={query.data?.items ?? []}
        columns={columns}
        caption="Solicitudes de documentos de afiliación"
        searchPlaceholder="Buscar por negocio o contacto…"
        serverSearch={{
          value: search,
          onChange: (value) => {
            setSearch(value)
            setPage(1)
          },
        }}
        toolbar={
          <Combobox
            value={status}
            ariaLabel="Estado de solicitud"
            className="sm:w-60 text-[var(--ink-muted)]"
            placeholder="Todos los estados"
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'DRAFT', label: 'Esperando documentos' },
              { value: 'SUBMITTED', label: 'Recibida' },
              { value: 'REVOKED', label: 'Revocada' },
            ]}
          />
        }
        emptyState={{
          title: query.isError
            ? 'Solicitudes no disponibles'
            : query.isPending
              ? 'Cargando solicitudes…'
              : search || status
                ? 'Sin solicitudes para esta búsqueda'
                : 'Aún no hay solicitudes',
          description:
            'Crea una liga por negocio y compártela para recibir sus documentos de afiliación.',
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
        <p className="tabular text-sm text-[var(--ink-muted)]">
          {query.data
            ? `${query.data.total} ${query.data.total === 1 ? 'solicitud' : 'solicitudes'}`
            : 'Consultando solicitudes…'}
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            Anterior
          </Button>
          <span className="tabular text-sm">
            Página {page} de {Math.max(1, Math.ceil((query.data?.total ?? 0) / 25))}
          </span>
          <Button
            variant="secondary"
            disabled={!query.data || page * 25 >= query.data.total || query.isFetching}
            onClick={() => setPage((value) => value + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
      <Drawer open={creating} onOpenChange={setCreating}>
        <DrawerContent>
          <DrawerHeader onClose={() => setCreating(false)}>
            <DrawerTitle>Crear liga de documentos</DrawerTitle>
            <DrawerSubtitle>
              Vigencia de 14 días. No activa cobros ni aprueba al negocio.
            </DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody>
            <CreateRequestForm />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function CreateRequestForm() {
  const client = useQueryClient()
  const [businessName, setBusinessName] = useState('')
  const [provider, setProvider] = useState<DocumentProvider>('ANGELPAY')
  const [entityType, setEntityType] = useState<DocumentEntityType>('PERSONA_FISICA')
  const mutation = useMutation({
    mutationFn: createDocumentRequest,
    onSuccess: () => client.invalidateQueries({ queryKey: ['superadmin', 'document-requests'] }),
    onError: (error) => {
      const { title, description } = inspectApiError(error, 'crear la liga')
      toast.error(title, { description })
    },
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!businessName.trim() || mutation.isPending) return
    mutation.mutate({ provider, entityType, businessName: businessName.trim() })
  }
  if (mutation.data) return <RequestLinkPanel uploadUrl={mutation.data.uploadUrl} />
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        id="request-business-name"
        label="Nombre del negocio"
        hint={
          <span className="text-[var(--ink-muted)]">
            Etiqueta interna para identificar el expediente.
          </span>
        }
        value={businessName}
        onChange={(event) => setBusinessName(event.target.value)}
        required
        maxLength={160}
        disabled={mutation.isPending}
      />
      <div className="space-y-2">
        <p className="label text-[var(--ink-muted)]">Procesador</p>
        <Combobox
          ariaLabel="Procesador"
          value={provider}
          onChange={(value) => setProvider(value as DocumentProvider)}
          options={[
            { value: 'ANGELPAY', label: 'AngelPay' },
            { value: 'BLUMON', label: 'Blumon' },
          ]}
          disabled={mutation.isPending}
        />
      </div>
      <div className="space-y-2">
        <p className="label text-[var(--ink-muted)]">Tipo de persona</p>
        <Combobox
          ariaLabel="Tipo de persona"
          value={entityType}
          onChange={(value) => setEntityType(value as DocumentEntityType)}
          options={[
            { value: 'PERSONA_FISICA', label: 'Persona física' },
            { value: 'PERSONA_MORAL', label: 'Persona moral' },
          ]}
          disabled={mutation.isPending}
        />
      </div>
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={!businessName.trim() || mutation.isPending}
      >
        {mutation.isPending ? 'Generando…' : 'Generar liga'}
      </Button>
    </form>
  )
}
