import { describe, it, expect } from 'vitest'
import { rowsToAoa } from './xlsx'
import type { CSVColumn } from './csv'

interface Row {
  name: string
  amount: number
  when: Date | null
}
const columns: CSVColumn<Row>[] = [
  { key: 'name', header: 'Nombre', accessor: (r) => r.name },
  { key: 'amount', header: 'Monto', accessor: (r) => r.amount },
  { key: 'when', header: 'Fecha', accessor: (r) => r.when },
]

describe('rowsToAoa', () => {
  it('puts headers first, then one array per row', () => {
    const rows: Row[] = [{ name: 'A', amount: 10, when: new Date('2026-05-01T00:00:00.000Z') }]
    expect(rowsToAoa(rows, columns)).toEqual([
      ['Nombre', 'Monto', 'Fecha'],
      ['A', 10, '2026-05-01T00:00:00.000Z'],
    ])
  })
  it('renders null/undefined as empty string', () => {
    const rows: Row[] = [{ name: 'B', amount: 0, when: null }]
    expect(rowsToAoa(rows, columns)).toEqual([
      ['Nombre', 'Monto', 'Fecha'],
      ['B', 0, ''],
    ])
  })
})
