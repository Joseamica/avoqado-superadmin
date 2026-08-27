import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/shared/ui/Badge'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { DataTable } from '@/shared/data-table/DataTable'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate } from '@/shared/lib/datetime'
import { useAnnouncements, useArchiveAnnouncement, usePublishAnnouncement } from './use-announcements'
import { AnnouncementEditor } from './AnnouncementEditor'
import type { Announcement, AnnouncementStatus } from './types'

const ESTADO: Record<AnnouncementStatus, { label: string; tone: 'muted' | 'success' | 'warn' | 'info' }> = {
  DRAFT: { label: 'Borrador', tone: 'muted' },
  SCHEDULED: { label: 'Programado', tone: 'warn' },
  PUBLISHED: { label: 'Publicado', tone: 'success' },
  ARCHIVED: { label: 'Archivado', tone: 'muted' },
}

export function AnnouncementsPage() {
  const anuncios = useAnnouncements()
  const publicar = usePublishAnnouncement()
  const archivar = useArchiveAnnouncement()
  const [editorAbierto, setEditorAbierto] = useState(false)

  const columns = useMemo<ColumnDef<Announcement, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Anuncio',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-[13px] text-[var(--ink)]">{row.original.title}</div>
            <div className="truncate text-[12px] text-[var(--ink-muted)]">{row.original.body}</div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const e = ESTADO[row.original.status]
          return <Badge tone={e.tone}>{e.label}</Badge>
        },
      },
      {
        accessorKey: 'deliveredCount',
        header: () => <span className="block text-right">Alcance</span>,
        cell: ({ row }) => (
          <div className="tabular text-right text-[13px]">
            {row.original.deliveredAt ? (
              <span className="text-[var(--ink)]">{row.original.deliveredCount}</span>
            ) : (
              <span className="text-[var(--ink-faint)]">—</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'publishedAt',
        header: 'Publicado',
        cell: ({ row }) =>
          row.original.publishedAt ? (
            <span className="text-[13px] text-[var(--ink-muted)]">{formatDate(row.original.publishedAt)}</span>
          ) : (
            <span className="text-[13px] text-[var(--ink-faint)]">—</span>
          ),
      },
      {
        id: 'acciones',
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => {
          const a = row.original
          return (
            <div className="flex items-center justify-end gap-1.5">
              {(a.status === 'DRAFT' || a.status === 'SCHEDULED') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => publicar.mutate({ id: a.id })}
                  disabled={publicar.isPending}
                >
                  Publicar
                </Button>
              )}
              {a.status !== 'ARCHIVED' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => archivar.mutate(a.id)}
                  disabled={archivar.isPending}
                >
                  Archivar
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [publicar, archivar],
  )

  return (
    // Mismo contenedor que el resto de las páginas del repo: el <main> del layout NO da
    // padding, cada página pone el suyo. Sin esto el contenido se pega al borde y el
    // botón del header se sale de la pantalla.
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <header className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="eyebrow">Operación</p>
          <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.025em] text-[var(--ink)] sm:text-[34px]">
            Anuncios
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
            Novedades y promociones que Avoqado le manda a los negocios. Les llegan al buzón del
            dashboard y de las apps.
            <span className="tabular ml-2 text-[var(--ink-faint)]">
              · {anuncios.data ? `${anuncios.data.length} anuncios` : 'cargando…'}
            </span>
          </p>
        </div>
        <Button size="lg" className="shrink-0" onClick={() => setEditorAbierto(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Nuevo anuncio
        </Button>
      </header>

      {anuncios.isError && (
        <QueryError
          className="mb-5"
          error={anuncios.error}
          context="cargar los anuncios"
          onRetry={() => anuncios.refetch()}
        />
      )}

      <DataTable
        columns={columns}
        data={anuncios.data ?? []}
        searchPlaceholder="Buscar anuncio…"
        emptyState={{
          title: 'Todavía no hay anuncios',
          description: 'Crea el primero para avisarle a tus negocios de una función nueva o una promoción.',
        }}
        caption="Anuncios de plataforma"
      />

      <AnnouncementEditor abierto={editorAbierto} onClose={() => setEditorAbierto(false)} />
    </div>
  )
}
