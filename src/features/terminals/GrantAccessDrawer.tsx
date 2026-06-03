import { Badge } from '@/shared/ui/Badge'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerSubtitle,
  DrawerTitle,
} from '@/shared/ui/Drawer'
import { StaffAccessStep } from './StaffAccessStep'
import type { Terminal } from './types'

/**
 * Drawer standalone "Dar acceso a una persona" — el mismo paso de carry-over
 * que vive dentro del wizard de migración, pero usable en cualquier momento
 * sobre el venue actual de la terminal (sin `sourceVenueId`, así que el picker
 * muestra a toda la organización sin nada pre-seleccionado).
 *
 * Útil cuando una persona nueva necesita entrar a la terminal y no hay una
 * migración de por medio: el operador le da un rol + PIN directo.
 */
interface GrantAccessDrawerProps {
  terminal: Terminal | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GrantAccessDrawer({ terminal, open, onOpenChange }: GrantAccessDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {terminal ? (
          <GrantAccessDrawerBody
            // Key fuerza re-mount (reset de las filas seleccionadas) cuando
            // cambia la terminal o se reabre el drawer.
            key={`${terminal.id}:${open}`}
            terminal={terminal}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="p-8 text-center text-[13px] text-[var(--ink-muted)]">
            No hay terminal seleccionada.
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function GrantAccessDrawerBody({ terminal, onClose }: { terminal: Terminal; onClose: () => void }) {
  return (
    <>
      <DrawerHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <Badge tone="accent">Acceso</Badge>
        </div>
        <DrawerTitle className="mt-2">Dar acceso a una persona</DrawerTitle>
        <DrawerSubtitle>
          <span>en {terminal.venue.name}</span>
        </DrawerSubtitle>
      </DrawerHeader>

      <DrawerBody className="space-y-8">
        <StaffAccessStep
          destVenueId={terminal.venueId}
          destVenueName={terminal.venue.name}
          onDone={onClose}
          onSkip={onClose}
        />
      </DrawerBody>
    </>
  )
}
