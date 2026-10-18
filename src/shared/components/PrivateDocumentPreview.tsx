import { useEffect, useRef, useState } from 'react'
import { Eye, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/Dialog'
import type { PrivateDocumentPreviewData } from '@/shared/lib/venue-document-requests'
import { QueryError } from './QueryError'

interface PrivateDocumentPreviewProps {
  /** Includes the private scope, so switching request/venue/link/file starts a fresh session. */
  documentKey: string
  fileName: string
  requestPreview: () => Promise<PrivateDocumentPreviewData>
  onDownload: () => void
  isDownloading?: boolean
}
type PreviewState =
  | { status: 'idle' | 'signing' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: PrivateDocumentPreviewData; attempt: number }

export function PrivateDocumentPreview(props: PrivateDocumentPreviewProps) {
  return <PreviewSession key={props.documentKey} {...props} />
}

function PreviewSession({
  fileName,
  requestPreview,
  onDownload,
  isDownloading,
}: PrivateDocumentPreviewProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PreviewState>({ status: 'idle' })
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState<Error | null>(null)
  const attempt = useRef(0)
  // No query/cache: each opening and retry requests a fresh ephemeral signed URL.
  useEffect(
    () => () => {
      attempt.current += 1
    },
    [],
  )

  async function prepare() {
    const currentAttempt = ++attempt.current
    setState({ status: 'signing' })
    setImageError(null)
    setImageLoading(false)
    try {
      const data = await requestPreview()
      if (attempt.current !== currentAttempt) return
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(data.mimeType)) {
        throw new Error(
          'Este formato no admite vista previa. Descarga el documento para revisarlo.',
        )
      }
      setState({ status: 'ready', data, attempt: currentAttempt })
      setImageLoading(data.mimeType !== 'application/pdf')
    } catch (error) {
      if (attempt.current === currentAttempt) setState({ status: 'error', error })
    }
  }
  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) void prepare()
    else {
      attempt.current += 1
      setState({ status: 'idle' })
      setImageError(null)
      setImageLoading(false)
    }
  }
  const ready = state.status === 'ready' ? state : null
  const visibleName = ready?.data.fileName ?? fileName
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" aria-label={`Ver ${fileName}`}>
          <Eye className="h-4 w-4" aria-hidden />
          Ver
        </Button>
      </DialogTrigger>
      <DialogContent
        showClose={false}
        className="flex h-[92dvh] max-h-[92dvh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 overflow-hidden p-4 sm:p-6"
      >
        <header className="flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="break-all">{visibleName}</DialogTitle>
            <DialogDescription className="mt-1 text-sm">
              Vista privada temporal. Puedes cerrar, reintentar o descargar el archivo.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="secondary" aria-label="Cerrar vista previa">
              Cerrar
            </Button>
          </DialogClose>
        </header>
        {ready?.data.mimeType === 'application/pdf' && (
          <p className="shrink-0 text-sm text-[var(--ink-muted)]">
            El PDF usa el lector de tu navegador. Si no aparece, ábrelo en otra pestaña o descarga
            el archivo.
          </p>
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {state.status === 'signing' && (
            <p role="status" className="py-6 text-sm text-[var(--ink-muted)]">
              Preparando vista privada…
            </p>
          )}
          {state.status === 'error' && (
            <QueryError error={state.error} context="preparar la vista previa" />
          )}
          {ready &&
            (ready.data.mimeType === 'application/pdf' ? (
              <iframe
                key={ready.attempt}
                src={ready.data.url}
                title={`Vista previa de ${ready.data.fileName}`}
                referrerPolicy="no-referrer"
                className="min-h-0 w-full flex-1 border-0"
              />
            ) : (
              <>
                {imageLoading && (
                  <p role="status" className="py-3 text-sm text-[var(--ink-muted)]">
                    Cargando imagen…
                  </p>
                )}
                {imageError && <QueryError error={imageError} context="mostrar la imagen" />}
                <img
                  key={ready.attempt}
                  src={ready.data.url}
                  alt={ready.data.fileName}
                  referrerPolicy="no-referrer"
                  className={imageError ? 'hidden' : 'min-h-0 w-full flex-1 object-contain'}
                  onLoad={() => {
                    if (attempt.current === ready.attempt) setImageLoading(false)
                  }}
                  onError={() => {
                    if (attempt.current === ready.attempt) {
                      setImageLoading(false)
                      setImageError(
                        new Error(
                          'No se pudo mostrar la imagen. Reintenta para renovar la vista o descarga el archivo.',
                        ),
                      )
                    }
                  }}
                />
              </>
            ))}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
          {ready && (
            <a
              href={ready.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir en otra pestaña
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            aria-label="Reintentar vista previa"
            onClick={() => void prepare()}
          >
            Reintentar
          </Button>
          <Button
            type="button"
            aria-label="Descargar documento"
            disabled={isDownloading}
            onClick={onDownload}
          >
            {isDownloading ? 'Descargando…' : 'Descargar'}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
