import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'

describe('DataTable', () => {
  it('gives each table its own search box, so two tables on one page each keep their label', () => {
    const columns: ColumnDef<{ name: string }, unknown>[] = [
      { accessorKey: 'name', header: 'Nombre' },
    ]
    render(
      <>
        <DataTable data={[{ name: 'Pro' }]} columns={columns} searchPlaceholder="Buscar plan" />
        <DataTable data={[{ name: 'CFDI' }]} columns={columns} searchPlaceholder="Buscar función" />
      </>,
    )
    const plan = screen.getByLabelText('Buscar plan')
    const feature = screen.getByLabelText('Buscar función')
    expect(feature).not.toBe(plan)
    expect(feature.id).not.toBe(plan.id)
  })
})
