import { describe, it, expect, vi, beforeAll } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import {
  VenueDrawer,
  CuentaDrawer,
  MerchantDrawer,
  SlotDrawer,
  SettlementDrawer,
} from './AngelPaySetupDrawers'
import { INITIAL_ANGELPAY_DRAFT } from './angelpay-setup'
import type { AngelPayAccountOption, VenueOption } from './api'

// cmdk / Radix Popover (Combobox) usan ResizeObserver y scrollIntoView — no existen en jsdom.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const venues: VenueOption[] = [
  { id: 'v1', name: 'Tacos MX', slug: 'tacos-mx' },
  { id: 'v2', name: 'Café Centro', slug: 'cafe-centro' },
]

const accounts: AngelPayAccountOption[] = [
  { id: 'acc1', email: 'ops@avoqado.io', status: 'ACTIVE', environment: 'PROD' },
]

describe('VenueDrawer', () => {
  it('guarda el venue seleccionado con su nombre', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(
      <VenueDrawer open onOpenChange={() => {}} venues={venues} value={null} onSave={onSave} />,
    )
    await user.click(screen.getByRole('button', { name: 'Venue' }))
    await waitFor(() => expect(screen.getByText('Tacos MX')).toBeInTheDocument())
    await user.click(screen.getByText('Tacos MX'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({ venueId: 'v1', venueName: 'Tacos MX' })
  })

  it('guarda null cuando no hay venue elegido', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <VenueDrawer open onOpenChange={() => {}} venues={venues} value={null} onSave={onSave} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({ venueId: null, venueName: null })
  })
})

describe('CuentaDrawer', () => {
  it('en modo "Nueva" captura correo y PIN (sólo dígitos, máx 6)', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <CuentaDrawer
        open
        onOpenChange={() => {}}
        draft={INITIAL_ANGELPAY_DRAFT}
        accounts={accounts}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'nuevo@avoqado.io' } })
    // El PIN filtra no-dígitos y corta a 6.
    fireEvent.change(screen.getByLabelText('PIN (6 dígitos)'), { target: { value: '12a34b5678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({
      loginMode: 'new',
      angelpayUserAccountId: null,
      email: 'nuevo@avoqado.io',
      pin: '123456',
      environment: 'QA',
    })
  })

  it('en modo "Existente" guarda la cuenta seleccionada', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(
      <CuentaDrawer
        open
        onOpenChange={() => {}}
        draft={INITIAL_ANGELPAY_DRAFT}
        accounts={accounts}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByLabelText('Existente'))
    await user.click(screen.getByRole('button', { name: 'Cuenta AngelPay' }))
    await waitFor(() => expect(screen.getByText('ops@avoqado.io')).toBeInTheDocument())
    await user.click(screen.getByText('ops@avoqado.io'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ loginMode: 'existing', angelpayUserAccountId: 'acc1' }),
    )
  })
})

describe('MerchantDrawer', () => {
  it('filtra el ID a dígitos y trimea los campos al guardar', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <MerchantDrawer
        open
        onOpenChange={() => {}}
        draft={INITIAL_ANGELPAY_DRAFT}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByLabelText('ID del merchant (numérico)'), {
      target: { value: 'ab12cd34' },
    })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Tacos MX  ' } })
    fireEvent.change(screen.getByLabelText('Afiliación'), { target: { value: ' 778899 ' } })
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: ' Principal ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({
      externalMerchantId: '1234',
      merchantName: 'Tacos MX',
      affiliation: '778899',
      displayName: 'Principal',
      apiKey: '',
    })
  })
})

describe('SlotDrawer', () => {
  it('en modo "fill" guarda sin cuenta reemplazada', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <SlotDrawer open onOpenChange={() => {}} draft={INITIAL_ANGELPAY_DRAFT} onSave={onSave} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({
      accountType: 'PRIMARY',
      slotMode: 'fill',
      replacedAccountId: null,
    })
  })

  it('en modo "replace" muestra el campo y guarda el id a reemplazar', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderWithProviders(
      <SlotDrawer open onOpenChange={() => {}} draft={INITIAL_ANGELPAY_DRAFT} onSave={onSave} />,
    )
    await user.click(screen.getByRole('button', { name: 'Modo de slot' }))
    await waitFor(() => expect(screen.getByText('Reemplazar')).toBeInTheDocument())
    await user.click(screen.getByText('Reemplazar'))
    const replaced = await screen.findByLabelText('ID de la cuenta a reemplazar')
    fireEvent.change(replaced, { target: { value: 'old-acc-9' } })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ slotMode: 'replace', replacedAccountId: 'old-acc-9' }),
    )
  })
})

describe('SettlementDrawer', () => {
  it('edita días por tipo de tarjeta (no-numérico cae a 0) y el corte', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <SettlementDrawer
        open
        onOpenChange={() => {}}
        draft={INITIAL_ANGELPAY_DRAFT}
        onSave={onSave}
      />,
    )
    fireEvent.change(screen.getByLabelText('Días Débito'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Días Crédito'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Corte'), { target: { value: '22:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({
      settlement: { DEBIT: 5, CREDIT: 0, AMEX: 3, INTERNATIONAL: 3 },
      settlementDayType: 'BUSINESS_DAYS',
      cutoffTime: '22:30',
    })
  })
})
