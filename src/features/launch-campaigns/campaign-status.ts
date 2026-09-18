import { formatDate } from '@/shared/lib/datetime'
import type { LaunchCampaignRow } from './types'

/**
 * Qué está haciendo la campaña AHORA MISMO, en una palabra.
 *
 * 🔴 El estado guardado (`status`) no alcanza: una ficha ACTIVE puede estar
 * vencida, llena o todavía sin arrancar, y en los tres casos la landing NO la
 * está ofreciendo. Pintar "Activa" ahí dejaría al operador creyendo que su
 * anuncio vende cuando no vende — que es justo el fallo caro, porque se ve como
 * una campaña con mala conversión y es indistinguible de un anuncio malo.
 *
 * 🔴 El ORDEN de los motivos es el mismo que el de `launchOfferAvailability` del
 * servidor (§3.1). Si divergiera, esta pantalla diría una cosa y el endpoint
 * público de la landing otra sobre la misma ficha.
 */
export interface EstadoVisible {
  label:
    | 'Borrador'
    | 'Terminada'
    | 'Pausada'
    | 'Programada'
    | 'Vencida'
    | 'Llena'
    | 'Sin publicar'
    | 'Activa'
  tone: 'muted' | 'success' | 'warn' | 'danger' | 'info'
  /** Una frase que dice qué significa y, cuando aplica, qué hacer. */
  explicacion: string
  /** ¿La landing la está ofreciendo en este instante? */
  vendiendo: boolean
}

export function estadoDeLaCampana(c: LaunchCampaignRow, now: Date = new Date()): EstadoVisible {
  if (c.status === 'DRAFT') {
    return {
      label: 'Borrador',
      tone: 'muted',
      explicacion: 'Todavía no se ofrece en la landing. Actívala cuando el anuncio esté listo.',
      vendiendo: false,
    }
  }

  if (c.status === 'ENDED') {
    return {
      label: 'Terminada',
      tone: 'muted',
      explicacion: c.statusReason
        ? `Terminada: ${c.statusReason}`
        : 'Terminada. Se conserva como historia; no vuelve a ofrecerse.',
      vendiendo: false,
    }
  }

  if (c.status === 'PAUSED') {
    return {
      label: 'Pausada',
      tone: 'warn',
      explicacion: c.statusReason
        ? `Pausada: ${c.statusReason}. Quien ya apartó su lugar conserva su precio.`
        : 'Pausada. No se ofrece, y quien ya apartó su lugar conserva su precio.',
      vendiendo: false,
    }
  }

  const desde = new Date(c.validFrom)
  const hasta = new Date(c.validUntil)

  if (now < desde) {
    return {
      label: 'Programada',
      tone: 'info',
      explicacion: `Empieza a ofrecerse el ${formatDate(c.validFrom)}.`,
      vendiendo: false,
    }
  }

  if (now >= hasta) {
    return {
      label: 'Vencida',
      tone: 'danger',
      explicacion: `Su vigencia terminó el ${formatDate(c.validUntil)}. Para seguir vendiendo, alarga la vigencia.`,
      vendiendo: false,
    }
  }

  if (c.redemptionCount >= c.redemptionCap) {
    return {
      label: 'Llena',
      tone: 'danger',
      explicacion: `Se acabó el cupo: ${c.redemptionCount} de ${c.redemptionCap}. Súbelo para seguir vendiendo.`,
      vendiendo: false,
    }
  }

  // Estado imposible por contrato — una ficha ACTIVE siempre congeló su cupón al
  // activarse. Si llegara, la landing contestaría NOT_PUBLISHED, así que se avisa
  // en vez de pintar "Activa" sobre algo que no se está ofreciendo.
  if (!c.stripeCouponId || c.listPriceCentsSnapshot === null) {
    return {
      label: 'Sin publicar',
      tone: 'warn',
      explicacion:
        'Está marcada como activa pero le falta el cupón congelado: la landing no la ofrece. Vuelve a activarla.',
      vendiendo: false,
    }
  }

  return {
    label: 'Activa',
    tone: 'success',
    explicacion: `Se está ofreciendo. Termina el ${formatDate(c.validUntil)}.`,
    vendiendo: true,
  }
}

/**
 * Cuántos lugares llevan APARTADOS más de la cuenta.
 *
 * 🔴 No es una métrica decorativa. Un lugar RESERVED que nadie reintenta —la
 * tarjeta falló y la persona cerró la pestaña— consume cupo para siempre, porque
 * el barrido automático que lo liberaría quedó fuera de la fase 1. Si esto no se
 * ve, la campaña se queda "llena" de lugares fantasma y desde afuera es idéntica
 * a una que de verdad se agotó: el anuncio sigue pagándose y ya no vende nada.
 */
export function reservasEstancadas(
  filas: { reservedAt: string }[] | undefined | null,
  now: Date = new Date(),
  ms = 30 * 60_000,
): number {
  if (!filas?.length) return 0
  return filas.filter((f) => {
    const t = new Date(f.reservedAt).getTime()
    if (Number.isNaN(t)) return false
    return now.getTime() - t > ms
  }).length
}
