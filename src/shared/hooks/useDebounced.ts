import { useEffect, useState } from 'react'

/**
 * Devuelve `value` con retraso.
 *
 * 🔴 Existe por el conteo en vivo de la audiencia: sin esto sería una consulta por cada
 * tecla, y del otro lado esa consulta recorre los vínculos de TODO el personal de la
 * plataforma. La auditoría lo marcó explícitamente.
 */
export function useDebounced<T>(value: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return retrasado
}
