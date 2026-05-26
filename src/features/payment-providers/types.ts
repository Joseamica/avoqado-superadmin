/**
 * Types y templates del feature Payment Providers.
 *
 * Un `PaymentProvider` es el "proveedor de pagos" — la empresa que procesa
 * transacciones (Blumon, AngelPay, Menta, Stripe, etc.). Cada provider
 * tiene 0..N `MerchantAccount`s asignadas (cuentas específicas dentro del
 * proveedor). Los providers se configuran una vez por país y luego los
 * merchant accounts heredan / extienden esa config.
 *
 * Mirror del backend (`avoqado-server/prisma/schema.prisma`):
 *   enum ProviderType { PAYMENT_PROCESSOR | BANK_DIRECT | WALLET | GATEWAY | OTHER }
 */

export type ProviderType = 'PAYMENT_PROCESSOR' | 'BANK_DIRECT' | 'WALLET' | 'GATEWAY' | 'OTHER'

export interface PaymentProvider {
  id: string
  /** Código único — BLUMON, ANGELPAY, MENTA, CLIP, STRIPE, etc. UPPERCASE. */
  code: string
  /** Nombre legible para humanos. */
  name: string
  type: ProviderType
  /** ISO-2 country codes — ["MX"], ["MX", "AR"], etc. */
  countryCode: string[]
  active: boolean
  /**
   * JSON schema (opcional) que describe qué campos debe llenar
   * `MerchantAccount.providerConfig` cuando se asocia a este provider.
   * Lo expone el form de creación de merchant account.
   */
  configSchema: Record<string, unknown> | null
  /** Cuántos merchant accounts usan este provider. Read-only del backend. */
  merchantsCount?: number
  /** Cuántas cost structures están configuradas para este provider. */
  costStructuresCount?: number
  createdAt: string
  updatedAt: string
}

/* --- Humanizers --- */

export function humanizeProviderType(type: ProviderType): string {
  switch (type) {
    case 'PAYMENT_PROCESSOR':
      return 'Procesador de pagos'
    case 'BANK_DIRECT':
      return 'Banco directo'
    case 'WALLET':
      return 'Wallet'
    case 'GATEWAY':
      return 'Gateway'
    case 'OTHER':
      return 'Otro'
  }
}

type Tone = 'muted' | 'success' | 'warn' | 'danger' | 'info' | 'accent'

export const PROVIDER_TYPE_TONE: Record<ProviderType, Tone> = {
  PAYMENT_PROCESSOR: 'accent',
  BANK_DIRECT: 'info',
  WALLET: 'info',
  GATEWAY: 'accent',
  OTHER: 'muted',
}

/* --- Templates pre-fillables --- */

/**
 * Plantillas para el form de creación. El operador puede empezar de cero
 * (template `custom`) o elegir uno preconfigurado. Los configSchemas son
 * los reales del `prisma/seed.ts` — si se cambia el seed, sincronizar aquí.
 *
 * Cuando el operador edita un provider EXISTENTE, el template se infiere
 * del `code` (BLUMON → template "blumon"); no es required pero ayuda al UI
 * a mostrar el ícono y descripción correctos.
 */
export interface ProviderTemplate {
  key: string
  label: string
  description: string
  /** Color de fondo del card para la grid de selección — semantic tone. */
  tone: Tone
  defaults: {
    code: string
    name: string
    type: ProviderType
    countryCode: string[]
    configSchema: Record<string, unknown> | null
  }
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    key: 'blumon',
    label: 'Blumon',
    description: 'Procesador PAX en México. Requiere serialNumber + posId + environment.',
    tone: 'accent',
    defaults: {
      code: 'BLUMON',
      name: 'Blumon PAX Payment Solutions',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
      configSchema: {
        required: ['serialNumber', 'posId', 'environment'],
        properties: {
          serialNumber: {
            type: 'string',
            description: 'Blumon device serial number (e.g., 2841548417)',
          },
          posId: {
            type: 'string',
            description: 'Momentum API position ID (CRITICAL for payment routing)',
          },
          environment: {
            type: 'string',
            enum: ['SANDBOX', 'PRODUCTION'],
            description: 'Blumon environment',
          },
          merchantId: {
            type: 'string',
            description: 'Blumon merchant identifier',
          },
        },
      },
    },
  },
  {
    key: 'angelpay',
    label: 'AngelPay',
    description: 'Procesador NEXGO en México. ExternalMerchantId carga el MerchantId real.',
    tone: 'info',
    defaults: {
      code: 'ANGELPAY',
      name: 'Angel Pay',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
      configSchema: {
        type: 'object',
        // externalMerchantId carries the AngelPay merchant ID — already required + unique-per-provider on MerchantAccount.
        required: [],
        properties: {
          angelpayAffiliation: {
            type: 'string',
            description: 'Display affiliation number (from MerchantOption.afiliationNumber)',
          },
          angelpayMerchantName: {
            type: 'string',
            description: 'Display merchant name (from MerchantOption.name)',
          },
        },
      },
    },
  },
  {
    key: 'menta',
    label: 'Menta',
    description: 'Gateway de pagos. Requiere apiKey + merchantId.',
    tone: 'accent',
    defaults: {
      code: 'MENTA',
      name: 'Menta',
      type: 'GATEWAY',
      countryCode: ['MX'],
      configSchema: {
        type: 'object',
        required: ['apiKey', 'merchantId'],
        properties: {
          apiKey: { type: 'string', description: 'Menta API key' },
          merchantId: { type: 'string', description: 'Menta merchant ID' },
          environment: { type: 'string', enum: ['sandbox', 'production'] },
        },
      },
    },
  },
  {
    key: 'stripe',
    label: 'Stripe',
    description:
      'Gateway internacional. Para checkout web y Stripe Connect (subscriptions de venues).',
    tone: 'info',
    defaults: {
      code: 'STRIPE',
      name: 'Stripe',
      type: 'GATEWAY',
      countryCode: ['MX', 'US'],
      configSchema: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string', description: 'Stripe Connect account ID (acct_…)' },
          publishableKey: { type: 'string', description: 'pk_live_… or pk_test_…' },
        },
      },
    },
  },
  {
    key: 'custom',
    label: 'Custom',
    description: 'Empezar de cero. Llenar todos los campos manualmente.',
    tone: 'muted',
    defaults: {
      code: '',
      name: '',
      type: 'PAYMENT_PROCESSOR',
      countryCode: ['MX'],
      configSchema: null,
    },
  },
]

/** Mapea un `code` a su template (case-insensitive). Útil al editar. */
export function inferTemplateFromCode(code: string): ProviderTemplate | undefined {
  const c = code.trim().toUpperCase()
  if (!c) return undefined
  return PROVIDER_TEMPLATES.find((t) => t.defaults.code.toUpperCase() === c)
}

/* --- País helpers --- */

/**
 * Catálogo mínimo de países donde operan los providers. Avoqado es B2B
 * MX-first; agregamos otros cuando aparezcan. ISO-2.
 */
export const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'MX', name: 'México' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Perú' },
  { code: 'CL', name: 'Chile' },
  { code: 'BR', name: 'Brasil' },
]
