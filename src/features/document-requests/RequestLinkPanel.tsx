import { toast } from 'sonner'
import { Field } from '@/shared/ui/Field'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { inspectApiError } from '@/shared/lib/api-error'

export function RequestLinkPanel({ uploadUrl }: { uploadUrl: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(uploadUrl)
      toast.success('Liga copiada')
    } catch (error) {
      const { title, description } = inspectApiError(error, 'copiar la liga')
      toast.error(title, { description: `${description} Puedes copiarla desde el campo de liga.` })
    }
  }
  return (
    <section
      className="space-y-3 border-y border-[var(--line)] py-5"
      aria-label="Liga para el cliente"
    >
      <p className="font-medium">Copia esta liga antes de cerrar</p>
      <p className="text-sm text-[var(--ink-muted)]">
        Por seguridad sólo se muestra ahora. Renovar genera otra liga e invalida la anterior.
      </p>
      <Field
        id="request-upload-url"
        label="Liga de entrega"
        readOnly
        value={uploadUrl}
        onFocus={(event) => event.target.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={copy} className="h-11">
          Copiar liga
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Comparte tus documentos de afiliación de forma segura aquí: ${uploadUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'secondary', className: 'h-11' })}
        >
          Compartir por WhatsApp
        </a>
      </div>
      <p className="text-sm text-[var(--ink-muted)]">
        WhatsApp abre el mensaje para que elijas destinatario y lo envíes.
      </p>
    </section>
  )
}
