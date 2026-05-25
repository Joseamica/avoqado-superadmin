import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { CardRatesInput } from './CardRatesInput'
import type { CardRates } from './types'

const ZERO_RATES: CardRates = { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 }

export function CardDrawer({
  open,
  onOpenChange,
  title,
  children,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  children: React.ReactNode
  onSave: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody>
          <div className="flex flex-col gap-4">{children}</div>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave()
              onOpenChange(false)
            }}
          >
            Guardar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function RatesDrawer({
  open,
  onOpenChange,
  title,
  value,
  includesTax,
  onSave,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  value: CardRates | null
  includesTax: boolean
  onSave: (rates: CardRates, includesTax: boolean) => void
}) {
  const [rates, setRates] = useState<CardRates>(value ?? ZERO_RATES)
  const [tax, setTax] = useState(includesTax)
  return (
    <CardDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      onSave={() => onSave(rates, tax)}
    >
      <CardRatesInput value={rates} onChange={setRates} idPrefix="rate" />
      <label className="flex items-center gap-2 text-[12px] text-[var(--ink-muted)]">
        <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} /> Las tasas
        ya incluyen IVA
      </label>
    </CardDrawer>
  )
}
