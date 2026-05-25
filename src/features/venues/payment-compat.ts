/** Provider code → brands de terminal compatibles. No listado = sin restricción. */
const PROVIDER_BRANDS: Record<string, string[]> = {
  BLUMON: ['PAX'],
  ANGELPAY: ['NEXGO'],
}

/** ¿El venue (con estos brands de terminal ACTIVO) puede operar este proveedor? */
export function isProviderCompatible(providerCode: string, venueBrands: string[]): boolean {
  const required = PROVIDER_BRANDS[providerCode]
  if (!required?.length) return true
  return venueBrands.some((b) => required.includes(b))
}
