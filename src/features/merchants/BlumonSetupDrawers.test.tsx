import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { AdditionalTerminalsDrawer, HardwareDrawer, RevenueShareDrawer } from './BlumonSetupDrawers'
import { INITIAL_DRAFT } from './blumon-setup'
import type { WizardTerminal } from './api'

const terminals: WizardTerminal[] = [
  {
    id: 't1',
    serialNumber: 'AAA',
    name: 'Barra',
    brand: 'PAX',
    model: 'A910S',
    type: 'TPV_ANDROID',
    status: 'ACTIVE',
  },
  {
    id: 't2',
    serialNumber: 'BBB',
    name: 'Caja',
    brand: 'PAX',
    model: 'A920',
    type: 'TPV_ANDROID',
    status: 'ACTIVE',
  },
  {
    id: 't3',
    serialNumber: 'CCC',
    name: 'Nexgo',
    brand: 'NEXGO',
    model: 'N86',
    type: 'TPV_ANDROID',
    status: 'ACTIVE',
  },
]

describe('AdditionalTerminalsDrawer', () => {
  it('excluye la terminal principal (por serial) y las de otra marca', () => {
    renderWithProviders(
      <AdditionalTerminalsDrawer
        open
        onOpenChange={() => {}}
        venueTerminals={terminals}
        mainSerial="AAA"
        mainBrand="PAX"
        value={[]}
        onSave={() => {}}
      />,
    )
    // t1 es la principal (serial AAA) → fuera; t3 es NEXGO → fuera; sólo t2.
    expect(screen.getByText('BBB')).toBeInTheDocument()
    expect(screen.queryByText('AAA')).not.toBeInTheDocument()
    expect(screen.queryByText('CCC')).not.toBeInTheDocument()
  })

  it('guarda los ids seleccionados', () => {
    const onSave = vi.fn()
    renderWithProviders(
      <AdditionalTerminalsDrawer
        open
        onOpenChange={() => {}}
        venueTerminals={terminals}
        mainSerial="AAA"
        mainBrand="PAX"
        value={[]}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith(['t2'])
  })
})

describe('HardwareDrawer', () => {
  it('en modo "Elegir existente" muestra el selector de terminal del venue', () => {
    renderWithProviders(
      <HardwareDrawer
        open
        onOpenChange={() => {}}
        draft={{ ...INITIAL_DRAFT, venueId: 'v1' }}
        venueTerminals={terminals}
        onSave={() => {}}
      />,
    )
    // Arranca por serial.
    expect(screen.getByLabelText('Serial')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Elegir existente'))
    expect(screen.getByText('Terminal del venue')).toBeInTheDocument()
  })
})

describe('RevenueShareDrawer', () => {
  it('muestra el modo agregador al seleccionarlo', () => {
    renderWithProviders(
      <RevenueShareDrawer open onOpenChange={() => {}} value={null} onSave={() => {}} />,
    )
    expect(screen.getByText('Avoqado del margen proveedor (%)')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Vía agregador/))
    expect(screen.getByText('Precio al agregador')).toBeInTheDocument()
  })
})
