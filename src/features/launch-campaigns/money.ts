import { formatMoney } from '@/shared/lib/money'

/**
 * El dinero de las campañas, en la frontera entre lo que se teclea y lo que viaja.
 *
 * 🔴 En la red TODO va en centavos enteros con IVA incluido. Los pesos con
 * decimales existen sólo dentro del input del editor, y estas dos funciones son
 * el único sitio donde se cruza esa frontera.
 */

/** "$1,158.84". Nulo se lee como raya: un monto que no existe no es cero. */
export function centsToLabel(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return '—'
  return formatMoney(cents / 100)
}

/**
 * Convierte lo que el operador teclea en pesos a centavos enteros.
 *
 * 🔴 La aritmética va por STRING, nunca `Number(x) * 100`. En binario
 * `18.97 * 100` vale 1896.9999999999998 y `22.005 * 100` vale 2200.4999999999998:
 * redondear el flotante da el centavo de abajo, y entonces el precio que se
 * anuncia deja de ser el que Stripe cobra. La diferencia es de un centavo y nadie
 * la ve hasta que un cliente compara su factura con el anuncio.
 *
 * @throws si el texto no es un número (se muestra como error del campo, no se adivina).
 */
export function pesosInputToCents(input: string): number {
  const limpio = input.trim().replace(/[$\s,]/g, '')
  if (!/^-?\d+(\.\d*)?$|^-?\.\d+$/.test(limpio)) {
    throw new Error(`"${input}" no es una cantidad en pesos`)
  }

  const negativo = limpio.startsWith('-')
  const sinSigno = negativo ? limpio.slice(1) : limpio
  const [enteros = '0', decimales = ''] = sinSigno.split('.')

  const centavosDeclarados = `${decimales}00`.slice(0, 2)
  // El tercer decimal decide el redondeo del centavo. Medio centavo hacia arriba,
  // igual que `Math.round`, pero sobre los dígitos y no sobre el flotante.
  const siguiente = decimales.charCodeAt(2) - 48
  const alza = siguiente >= 5 && siguiente <= 9 ? 1 : 0

  const total = Number(enteros) * 100 + Number(centavosDeclarados) + alza
  return negativo ? -total : total
}
