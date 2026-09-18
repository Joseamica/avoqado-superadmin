import { describe, expect, it } from 'vitest'
import { isoToMexicoLocalInput, mexicoLocalToIso } from './datetime'

/**
 * La Ciudad de México no tiene horario de verano desde 2022: su desplazamiento
 * es -06:00 los 365 días. Las dos funciones lo fijan LITERAL en vez de
 * preguntarle a la base de zonas, porque lo que se captura son fechas futuras
 * y una regla de verano que vuelva movería la vigencia una hora sin que nadie
 * lo pida.
 */
describe('mexicoLocalToIso', () => {
  it('le pega el desplazamiento fijo a lo que capturó el operador', () => {
    expect(mexicoLocalToIso('2026-09-20T00:00')).toBe('2026-09-20T00:00:00-06:00')
  })

  it('en julio NO cambia la hora (sin horario de verano)', () => {
    expect(mexicoLocalToIso('2026-07-15T13:45')).toBe('2026-07-15T13:45:00-06:00')
    expect(mexicoLocalToIso('2026-01-15T13:45')).toBe('2026-01-15T13:45:00-06:00')
  })

  it('acepta el valor con segundos que algunos navegadores mandan', () => {
    expect(mexicoLocalToIso('2026-09-20T00:00:30')).toBe('2026-09-20T00:00:30-06:00')
  })

  it('un valor vacío o mal formado devuelve null en vez de una fecha inventada', () => {
    expect(mexicoLocalToIso('')).toBeNull()
    expect(mexicoLocalToIso('2026-09-20')).toBeNull()
    expect(mexicoLocalToIso('mañana')).toBeNull()
  })
})

describe('isoToMexicoLocalInput', () => {
  it('trae el UTC del servidor a la hora de la Ciudad de México', () => {
    // 2026-09-20T06:00:00Z es la medianoche del 20 en CDMX.
    expect(isoToMexicoLocalInput('2026-09-20T06:00:00.000Z')).toBe('2026-09-20T00:00')
  })

  it('en julio tampoco cambia la hora', () => {
    expect(isoToMexicoLocalInput('2026-07-15T19:45:00.000Z')).toBe('2026-07-15T13:45')
  })

  it('ida y vuelta conserva el instante', () => {
    const local = '2026-10-31T18:00'
    const iso = mexicoLocalToIso(local)
    expect(iso).not.toBeNull()
    expect(isoToMexicoLocalInput(new Date(iso as string).toISOString())).toBe(local)
  })

  it('sin fecha devuelve cadena vacía, que es lo que un input espera', () => {
    expect(isoToMexicoLocalInput(null)).toBe('')
    expect(isoToMexicoLocalInput(undefined)).toBe('')
    expect(isoToMexicoLocalInput('no es una fecha')).toBe('')
  })
})
