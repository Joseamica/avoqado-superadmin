import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { IconButton } from './IconButton'

/**
 * Drawer del design system — slide desde la derecha en desktop, full-screen
 * en mobile. Construido sobre `@radix-ui/react-dialog` con styles posicionales
 * que lo alejan de su default centrado-modal.
 *
 * Por qué drawer y no modal:
 *   - El `.impeccable.md` dice "preferir drawer / inline / nueva ruta sobre
 *     modal — modal cuando no hay alternativa".
 *   - Para acciones secundarias sobre una entidad (ej. acciones sobre un
 *     terminal), el operador conserva el contexto de la lista detrás. Modal
 *     borra ese contexto.
 *
 * Uso típico:
 *
 *   <Drawer open={open} onOpenChange={setOpen}>
 *     <DrawerContent>
 *       <DrawerHeader>
 *         <DrawerTitle>…</DrawerTitle>
 *         <DrawerSubtitle>…</DrawerSubtitle>
 *       </DrawerHeader>
 *       <DrawerBody>…</DrawerBody>
 *     </DrawerContent>
 *   </Drawer>
 */

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close

export const DrawerOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // 640px default — suficiente para que un grid 2-col en el body
        // respire (~300px por columna útil) sin sentir página completa.
        // En viewport < 640px se vuelve full-screen automáticamente con
        // `w-full`. Override con `className="max-w-[…]"` si la página
        // necesita otro tamaño.
        'fixed right-0 top-0 z-50 flex h-full w-full max-w-[640px] flex-col border-l border-[var(--line-strong)] bg-[var(--canvas)] shadow-[-12px_0_30px_-12px_rgba(0,0,0,0.5)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out duration-200',
        'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        'focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DrawerContent.displayName = 'DrawerContent'

export function DrawerHeader({
  children,
  className,
  onClose,
}: {
  children: ReactNode
  className?: string
  /** Si se pasa, agrega un botón X en la esquina. Por default el overlay click ya cierra. */
  onClose?: () => void
}) {
  return (
    <header
      className={cn(
        'flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <DrawerClose asChild>
          <IconButton size="md" onClick={onClose} aria-label="Cerrar">
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        </DrawerClose>
      )}
    </header>
  )
}

export const DrawerTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'truncate font-display text-[18px] font-semibold leading-tight tracking-[-0.018em] text-[var(--ink)]',
      className,
    )}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

export const DrawerSubtitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-0.5 truncate text-[12px] text-[var(--ink-muted)]', className)}
    {...props}
  />
))
DrawerSubtitle.displayName = 'DrawerSubtitle'

export function DrawerBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)}>{children}</div>
}

export function DrawerFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <footer
      className={cn(
        'flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3',
        className,
      )}
    >
      {children}
    </footer>
  )
}
