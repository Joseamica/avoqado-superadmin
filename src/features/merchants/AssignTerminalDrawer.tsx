import { useState } from 'react'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { QueryError } from '@/shared/components/QueryError'
import { inspectApiError } from '@/shared/lib/api-error'
import { useAssignableTerminals, useSetTerminalServes } from './use-merchants'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
}

/**
 * Anexa una terminal a este merchant (capa de restricción explícita). El server
 * preserva la herencia: la terminal queda restringida a lo que ya servía + ésta.
 */
export function AssignTerminalDrawer({ open, onOpenChange, merchantId }: Props) {
  const q = useAssignableTerminals(open ? merchantId : undefined)
  const setServes = useSetTerminalServes(merchantId)
  const [selected, setSelected] = useState('')

  const terminals = q.data ?? []
  const options = terminals.map((t) => ({
    value: t.id,
    label: t.serialNumber || t.name || t.id,
    description: [t.venueName, t.brand].filter(Boolean).join(' · '),
  }))

  function handleAssign() {
    if (!selected) return
    setServes.mutate(
      { terminalId: selected, serves: true },
      {
        onSuccess: () => {
          toast.success('Terminal anexada')
          setSelected('')
          onOpenChange(false)
        },
        onError: (e) => {
          const i = inspectApiError(e, 'anexar la terminal')
          toast.error(i.title, { description: i.description })
        },
      },
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>Asignar terminal</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          {q.isError ? (
            <QueryError error={q.error} context="cargar terminales" onRetry={() => q.refetch()} />
          ) : q.isLoading ? (
            <p className="text-[13px] text-[var(--ink-faint)]">Cargando…</p>
          ) : terminals.length === 0 ? (
            <p className="text-[13px] text-[var(--ink-faint)]">
              No hay terminales para anexar; todas las compatibles de sus venues ya lo procesan.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="label">Terminal</span>
              <Combobox
                value={selected}
                onChange={setSelected}
                options={options}
                placeholder="Selecciona una terminal…"
                searchPlaceholder="Buscar por serial o venue…"
                emptyLabel="Sin terminales"
                ariaLabel="Terminal a anexar"
              />
              <p className="text-[11.5px] text-[var(--ink-faint)]">
                La terminal quedará restringida (dejará de heredar cambios futuros del slot del
                venue), pero conserva los merchants que ya servía.
              </p>
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleAssign} disabled={!selected || setServes.isPending}>
            {setServes.isPending ? 'Anexando…' : 'Anexar'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
