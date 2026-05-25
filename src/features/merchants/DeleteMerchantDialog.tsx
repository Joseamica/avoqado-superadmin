import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { inspectApiError } from '@/shared/lib/api-error'
import { useDeleteMerchant } from './use-merchants'
import type { MerchantAccount } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchant: MerchantAccount
  onDeleted?: () => void
}

export function DeleteMerchantDialog({ open, onOpenChange, merchant, onDeleted }: Props) {
  const del = useDeleteMerchant()
  const [error, setError] = useState<string | null>(null)
  const { costStructures, venueConfigs, terminals } = merchant.counts
  const hasDeps = costStructures > 0 || venueConfigs > 0

  function handleDelete() {
    setError(null)
    del.mutate(merchant.id, {
      onSuccess: () => {
        toast.success('Cuenta eliminada')
        onOpenChange(false)
        onDeleted?.()
      },
      onError: (err) => {
        const i = inspectApiError(err, 'eliminar la cuenta')
        setError(i.description)
        toast.error(i.title, { description: i.description })
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Borrar «{merchant.displayName ?? merchant.externalMerchantId}»</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer.
            {hasDeps
              ? ` Esta cuenta tiene ${costStructures} estructura(s) de costo y ${venueConfigs} asignación(es) a venue; el servidor puede impedir el borrado mientras existan.`
              : ' No tiene costos ni venues asociados.'}
            {terminals > 0 ? ` Está asignada a ${terminals} terminal(es).` : ''}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={del.isPending}>
            {del.isPending ? 'Borrando…' : 'Borrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
