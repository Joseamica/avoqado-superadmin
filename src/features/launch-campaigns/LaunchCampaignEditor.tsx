import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { Drawer, DrawerClose, DrawerContent, DrawerSubtitle, DrawerTitle } from '@/shared/ui/Drawer'
import { Field } from '@/shared/ui/Field'
import { IconButton } from '@/shared/ui/IconButton'
import { useDebounced } from '@/features/announcements/useDebounced'
import { centsToLabel, pesosInputToCents } from './money'
import { isoToMexicoLocalInput, mexicoLocalToIso } from './datetime'
import {
  campoBloqueado,
  couponIdFor,
  desgloseEsExacto,
  problemasDeLaCampana,
  type BorradorCampana,
  type CampoDeCampana,
  type EstadoDeLaFicha,
} from './offer-rules'
import {
  useCreateLaunchCampaign,
  useLaunchOfferPreview,
  useUpdateLaunchCampaign,
} from './use-launch-campaigns'
import type {
  CreateLaunchCampaignInput,
  LaunchCampaignChannel,
  LaunchCampaignPlanTier,
  LaunchCampaignRow,
  LaunchCampaignVertical,
} from './types'

const VERTICALES: { value: LaunchCampaignVertical; label: string; description?: string }[] = [
  { value: 'ALL', label: 'Todos los giros', description: 'La oferta aplica a cualquier negocio' },
  { value: 'FOOD_SERVICE', label: 'Restaurantes y cafeterías' },
  { value: 'RETAIL', label: 'Tiendas' },
  { value: 'SERVICES', label: 'Servicios', description: 'Estéticas, spas, gimnasios, clínicas' },
  { value: 'HOSPITALITY', label: 'Hospedaje' },
  { value: 'ENTERTAINMENT', label: 'Entretenimiento' },
]

const CANALES: { value: string; label: string }[] = [
  { value: '', label: 'Sin canal' },
  { value: 'GOOGLE_ADS', label: 'Google Ads' },
  { value: 'META', label: 'Meta' },
  { value: 'OPENAI_ADS', label: 'OpenAI Ads' },
  { value: 'MULTI', label: 'Varios canales' },
  { value: 'OTHER', label: 'Otro' },
]

const PLANES: { value: LaunchCampaignPlanTier; label: string }[] = [
  { value: 'PRO', label: 'Pro' },
  { value: 'PREMIUM', label: 'Premium' },
]

function borradorInicial(c?: LaunchCampaignRow | null): BorradorCampana {
  return {
    code: c?.code ?? '',
    name: c?.name ?? '',
    landingSlug: c?.landingSlug ?? '',
    vertical: c?.vertical ?? 'ALL',
    channel: c?.channel ?? '',
    planTier: c?.planTier ?? 'PRO',
    // El precio viaja en centavos y se edita en pesos: ésta es la única
    // conversión de ida, y `money.ts` es el único sitio donde ocurre.
    advertisedPrice: c ? (c.advertisedPriceCents / 100).toFixed(2) : '',
    discountMonths: c ? String(c.discountMonths) : '3',
    redemptionCap: c ? String(c.redemptionCap) : '',
    validFrom: isoToMexicoLocalInput(c?.validFrom),
    validUntil: isoToMexicoLocalInput(c?.validUntil),
    headline: c?.headline ?? '',
    subheadline: c?.subheadline ?? '',
    bullets: c?.bullets ?? [],
  }
}

/**
 * El editor: crea y edita la misma ficha.
 *
 * 🔴 El formulario vive en un componente INTERNO, montado dentro de
 * `<DrawerContent>`. Radix lo monta al abrir y lo desmonta al cerrar, así que el
 * estado se siembra en CADA apertura con los datos que ya cargaron. Sembrarlo en
 * el componente de afuera deja la primera apertura en blanco aunque la lista de
 * atrás ya pinte lo real — el defecto que costó tres drawers el 14-sep.
 */
export function LaunchCampaignEditor({
  abierto,
  onClose,
  campana,
}: {
  abierto: boolean
  onClose: () => void
  campana?: LaunchCampaignRow | null
}) {
  return (
    <Drawer open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-w-[720px]">
        <FormularioDeCampana campana={campana ?? null} onClose={onClose} />
      </DrawerContent>
    </Drawer>
  )
}

function FormularioDeCampana({
  campana,
  onClose,
}: {
  campana: LaunchCampaignRow | null
  onClose: () => void
}) {
  const editando = campana !== null
  const [b, setB] = useState<BorradorCampana>(() => borradorInicial(campana))

  const ficha: EstadoDeLaFicha = {
    status: campana?.status ?? 'DRAFT',
    activatedAt: campana?.activatedAt ?? null,
    redemptionCount: campana?.redemptionCount ?? 0,
  }
  /** En una ficha nueva el código sí se escribe; en una existente es inmutable. */
  const bloqueo = (campo: CampoDeCampana) => (editando ? campoBloqueado(campo, ficha) : null)

  const set = <K extends CampoDeCampana>(campo: K, valor: BorradorCampana[K]) =>
    setB((prev) => ({ ...prev, [campo]: valor }))

  // La vista previa pega en Stripe: sin retraso sería una consulta por tecla del
  // precio. 400 ms es lo que el diseño fija.
  const oferta = useMemo(() => {
    try {
      const cents = pesosInputToCents(b.advertisedPrice)
      const meses = Number(b.discountMonths)
      if (!Number.isInteger(meses) || meses < 1) return null
      return {
        planTier: b.planTier,
        billingInterval: 'MONTHLY' as const,
        advertisedPriceCents: cents,
        discountMonths: meses,
      }
    } catch {
      return null
    }
  }, [b.advertisedPrice, b.discountMonths, b.planTier])
  const ofertaDebounced = useDebounced(oferta, 400)
  const vista = useLaunchOfferPreview(ofertaDebounced, ofertaDebounced !== null)

  const errores = problemasDeLaCampana(b, {
    listPriceCents: vista.data?.listPriceCents ?? campana?.listPriceCentsSnapshot ?? null,
    redemptionCount: campana?.redemptionCount,
  })
  const sinErrores = Object.keys(errores).length === 0

  const crear = useCreateLaunchCampaign()
  const actualizar = useUpdateLaunchCampaign()
  const trabajando = crear.isPending || actualizar.isPending

  const guardar = async () => {
    if (!sinErrores) return
    const bullets = b.bullets.map((x) => x.trim()).filter(Boolean)
    // 🔴 `validFrom` NO va aquí, y el motivo es exactamente por qué se escapaba:
    // abajo se decide campo por campo qué viaja, y esa decisión se escribe como
    // `...{}` cuando el campo está bloqueado. Esparcir un objeto vacío no BORRA
    // una llave que `comun` ya puso: sólo no la añade. Con `validFrom` dentro de
    // `comun` el `...desde` no tenía nada que hacer, así que viajaba siempre — y
    // el servidor lo congela en cuanto la campaña vendió un lugar, de modo que
    // toda edición de una campaña que ya convierte moría con un 409 `FIELD_LOCKED`.
    // Un campo condicional vive SÓLO en su propio bloque condicional.
    const comun = {
      name: b.name.trim(),
      vertical: b.vertical,
      channel: (b.channel === '' ? null : b.channel) as LaunchCampaignChannel | null,
      validUntil: mexicoLocalToIso(b.validUntil) as string,
      redemptionCap: Number(b.redemptionCap),
      headline: b.headline.trim() || null,
      subheadline: b.subheadline.trim() || null,
      bullets,
    }

    if (editando && campana) {
      // Sólo viaja lo que esta ficha PUEDE cambiar en su estado: mandar un campo
      // bloqueado le gana un 409 `FIELD_LOCKED` al operador aunque no lo haya tocado.
      const oferta = campoBloqueado('advertisedPrice', ficha)
        ? {}
        : {
            planTier: b.planTier,
            billingInterval: 'MONTHLY' as const,
            advertisedPriceCents: pesosInputToCents(b.advertisedPrice),
            discountMonths: Number(b.discountMonths),
          }
      const slug = campoBloqueado('landingSlug', ficha)
        ? {}
        : { landingSlug: b.landingSlug.trim().toLowerCase() }
      const desde = campoBloqueado('validFrom', ficha)
        ? {}
        : { validFrom: mexicoLocalToIso(b.validFrom) as string }

      await actualizar.mutateAsync({
        id: campana.id,
        input: {
          ...comun,
          ...oferta,
          ...slug,
          ...desde,
          // 🔴 La revisión optimista: el `updatedAt` que se LEYÓ al abrir. Si otro
          // operador guardó mientras tanto, el servidor contesta 409 y nadie pisa
          // el trabajo del otro en silencio.
          expectedUpdatedAt: campana.updatedAt,
        },
      })
    } else {
      const input: CreateLaunchCampaignInput = {
        ...comun,
        // Al crear no hay nada congelado: la vigencia completa es obligatoria.
        validFrom: mexicoLocalToIso(b.validFrom) as string,
        code: b.code.trim().toUpperCase(),
        landingSlug: b.landingSlug.trim().toLowerCase(),
        planTier: b.planTier,
        billingInterval: 'MONTHLY',
        advertisedPriceCents: pesosInputToCents(b.advertisedPrice),
        discountMonths: Number(b.discountMonths),
      }
      await crear.mutateAsync(input)
    }
    onClose()
  }

  const cuponId = b.code.trim() ? couponIdFor(b.code, campana?.offerVersion ?? 1) : null

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--line-strong)] px-5 py-4">
        <div className="min-w-0">
          {/* `DrawerTitle`/`DrawerSubtitle` y no un <h2> suelto: Radix los usa
              para nombrar y describir el diálogo, y sin ellos un lector de
              pantalla anuncia un diálogo sin título. */}
          <DrawerTitle className="font-sans text-[15px] font-medium tracking-[-0.005em]">
            {editando ? `Editar ${campana?.code}` : 'Nueva campaña de lanzamiento'}
          </DrawerTitle>
          <DrawerSubtitle className="whitespace-normal">
            Un anuncio con su precio, su cupo y su vigencia. Se guarda como borrador: no se ofrece
            hasta activarla.
          </DrawerSubtitle>
        </div>
        <DrawerClose asChild>
          <IconButton aria-label="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </DrawerClose>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section className="space-y-4">
          <h3 className="text-[13px] font-medium text-[var(--ink)]">Identidad</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="code"
              label="Código"
              value={b.code}
              disabled={Boolean(bloqueo('code'))}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="POS22"
              error={errores.code}
              hint={
                bloqueo('code') ??
                'Viaja en el formulario y en la atribución. Se guarda en mayúsculas.'
              }
            />
            <Field
              name="landingSlug"
              label="Slug de la landing"
              value={b.landingSlug}
              disabled={Boolean(bloqueo('landingSlug'))}
              onChange={(e) => set('landingSlug', e.target.value)}
              placeholder="pos-22"
              error={errores.landingSlug}
              hint={
                bloqueo('landingSlug') ??
                `La página será /oferta/${b.landingSlug.trim().toLowerCase() || '…'}`
              }
            />
          </div>
          <Field
            name="name"
            label="Nombre interno"
            value={b.name}
            disabled={Boolean(bloqueo('name'))}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Punto de venta a $22 — septiembre"
            error={errores.name}
            hint={bloqueo('name') ?? 'Sólo lo ves tú. El cliente ve el encabezado de abajo.'}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink)]">
                Giro al que apunta
              </label>
              <Combobox
                value={b.vertical}
                onChange={(v) => set('vertical', v as LaunchCampaignVertical)}
                options={VERTICALES}
                disabled={Boolean(bloqueo('vertical'))}
                ariaLabel="Giro al que apunta"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink)]">Canal del anuncio</label>
              <Combobox
                value={b.channel}
                onChange={(v) => set('channel', v as LaunchCampaignChannel | '')}
                options={CANALES}
                disabled={Boolean(bloqueo('channel'))}
                ariaLabel="Canal del anuncio"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-[var(--line-strong)] pt-5">
          <div>
            <h3 className="text-[13px] font-medium text-[var(--ink)]">La oferta</h3>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              Los montos son con IVA incluido: lo que se muestra es lo que se cobra.
            </p>
          </div>

          {bloqueo('advertisedPrice') && (
            <p className="rounded-[8px] bg-[var(--warn-faint)] px-3.5 py-2.5 text-[12.5px] text-[var(--warn)]">
              {bloqueo('advertisedPrice')}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-[var(--ink)]">Plan</label>
              <Combobox
                value={b.planTier}
                onChange={(v) => set('planTier', v as LaunchCampaignPlanTier)}
                options={PLANES}
                disabled={Boolean(bloqueo('planTier'))}
                ariaLabel="Plan"
                width={220}
              />
            </div>
            <Field
              name="advertisedPrice"
              label="Precio final que paga el cliente"
              value={b.advertisedPrice}
              inputMode="decimal"
              disabled={Boolean(bloqueo('advertisedPrice'))}
              onChange={(e) => set('advertisedPrice', e.target.value)}
              placeholder="22.00"
              error={errores.advertisedPrice}
              // 🔴 «Precio anunciado (con IVA)» se leía como «súmale el IVA»: POS22 nació a
              // $25.52 (22 × 1.16) y una ficha activada ya no puede corregir su precio.
              hint="En pesos, con el IVA YA incluido: escribe el total, no le sumes el 16 %. Si quieres cobrar $22, pon 22.00."
            />
            <Field
              name="discountMonths"
              label="Ciclos con descuento"
              value={b.discountMonths}
              inputMode="numeric"
              disabled={Boolean(bloqueo('discountMonths'))}
              onChange={(e) => set('discountMonths', e.target.value)}
              placeholder="3"
              error={errores.discountMonths}
              hint="Meses a precio de oferta."
            />
          </div>

          <VistaPreviaDeLaOferta
            cargando={vista.isFetching}
            error={vista.isError}
            datos={vista.data}
            meses={Number(b.discountMonths)}
            cuponId={cuponId}
          />
        </section>

        <section className="space-y-4 border-t border-[var(--line-strong)] pt-5">
          <h3 className="text-[13px] font-medium text-[var(--ink)]">Cupo y vigencia</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              name="redemptionCap"
              label="Cupo"
              value={b.redemptionCap}
              inputMode="numeric"
              disabled={Boolean(bloqueo('redemptionCap'))}
              onChange={(e) => set('redemptionCap', e.target.value)}
              placeholder="100"
              error={errores.redemptionCap}
              hint={
                bloqueo('redemptionCap') ??
                (campana ? `${campana.redemptionCount} lugares tomados` : 'Cuántas altas acepta')
              }
            />
            <Field
              name="validFrom"
              type="datetime-local"
              label="Empieza"
              value={b.validFrom}
              disabled={Boolean(bloqueo('validFrom'))}
              onChange={(e) => set('validFrom', e.target.value)}
              error={errores.validFrom}
              hint={bloqueo('validFrom') ?? 'Hora de la Ciudad de México'}
            />
            <Field
              name="validUntil"
              type="datetime-local"
              label="Termina"
              value={b.validUntil}
              disabled={Boolean(bloqueo('validUntil'))}
              onChange={(e) => set('validUntil', e.target.value)}
              error={errores.validUntil}
              hint={
                bloqueo('validUntil') ??
                'No hay periodo de gracia: al llegar la hora deja de venderse.'
              }
            />
          </div>
        </section>

        <section className="space-y-4 border-t border-[var(--line-strong)] pt-5">
          <div>
            <h3 className="text-[13px] font-medium text-[var(--ink)]">Textos de la página</h3>
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              Lo que ve quien llega del anuncio. Opcionales.
            </p>
          </div>
          <Field
            name="headline"
            label="Encabezado"
            value={b.headline}
            disabled={Boolean(bloqueo('headline'))}
            onChange={(e) => set('headline', e.target.value)}
            placeholder="Tu punto de venta a $22 al mes"
            error={errores.headline}
            hint={bloqueo('headline') ?? `${b.headline.trim().length}/120`}
          />
          <Field
            name="subheadline"
            label="Subencabezado"
            value={b.subheadline}
            disabled={Boolean(bloqueo('subheadline'))}
            onChange={(e) => set('subheadline', e.target.value)}
            error={errores.subheadline}
            hint={bloqueo('subheadline') ?? `${b.subheadline.trim().length}/200`}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bullets" className="text-[12px] font-medium text-[var(--ink)]">
              Puntos (uno por línea)
            </label>
            <textarea
              id="bullets"
              rows={3}
              value={b.bullets.join('\n')}
              disabled={Boolean(bloqueo('bullets'))}
              onChange={(e) => set('bullets', e.target.value.split('\n'))}
              placeholder={'Cobra con tarjeta desde el primer día\nSin contrato forzoso'}
              className="w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[14px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:bg-[var(--canvas-raised)] disabled:opacity-60"
            />
            {errores.bullets ? (
              <p className="text-[11.5px] text-[var(--danger)]">{errores.bullets}</p>
            ) : (
              <p className="text-[11.5px] text-[var(--ink-faint)]">
                {bloqueo('bullets') ?? 'Máximo 6.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-[var(--ink)]">Así se verá la página</p>
            <VistaPreviaDeLaPagina
              planTier={b.planTier}
              precioTexto={b.advertisedPrice}
              meses={Number(b.discountMonths)}
              renovacionCents={vista.data?.renewalMonthlyCents}
              headline={b.headline}
              subheadline={b.subheadline}
              bullets={b.bullets}
              slug={b.landingSlug}
            />
          </div>
        </section>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line-strong)] px-5 py-3">
        <Button variant="ghost" onClick={onClose} disabled={trabajando}>
          Cancelar
        </Button>
        <Button onClick={guardar} disabled={!sinErrores || trabajando}>
          {trabajando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
      </div>
    </>
  )
}

/**
 * Los montos que el cliente va a ver y pagar.
 *
 * 🔴 Todos salen del servidor. Ni el precio de lista ni el desglose se calculan
 * aquí: el precio vive en Stripe, y una segunda aritmética en el navegador sería
 * otra verdad del mismo dinero.
 */
function VistaPreviaDeLaOferta({
  cargando,
  error,
  datos,
  meses,
  cuponId,
}: {
  cargando: boolean
  error: boolean
  datos?: {
    listPriceCents: number
    firstChargeCents: number
    promoTotalCents: number
    renewalMonthlyCents: number
    promo: { subtotalCents: number; ivaCents: number }
    problems: string[]
  }
  meses: number
  cuponId: string | null
}) {
  if (error) {
    return (
      <p className="rounded-[8px] bg-[var(--warn-faint)] px-3.5 py-3 text-[13px] text-[var(--warn)]">
        No se pudo leer el precio de lista en Stripe, así que no se puede mostrar la cuenta. El
        borrador se puede guardar igual; activar sí va a necesitar ese precio.
      </p>
    )
  }

  if (!datos) {
    return (
      <p className="rounded-[8px] border border-dashed border-[var(--line-strong)] px-3.5 py-3 text-[13px] text-[var(--ink-faint)]">
        {cargando
          ? 'Consultando el precio de lista en Stripe…'
          : 'Pon el precio y los ciclos para ver la cuenta.'}
      </p>
    )
  }

  const exacto = desgloseEsExacto(datos.promo)

  return (
    <div className="space-y-2.5 rounded-[8px] border border-[var(--line-strong)] px-3.5 py-3">
      <p className="text-[14px] text-[var(--ink)]">
        Hoy paga <span className="tabular font-medium">{centsToLabel(datos.firstChargeCents)}</span>{' '}
        · <span className="tabular">{meses}</span> {meses === 1 ? 'mes' : 'meses'} · después{' '}
        <span className="tabular font-medium">{centsToLabel(datos.renewalMonthlyCents)}</span> · IVA
        incluido
      </p>
      <dl className="grid gap-1 text-[12.5px] text-[var(--ink-muted)] sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt>Precio de lista</dt>
          <dd className="tabular">{centsToLabel(datos.listPriceCents)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Total del periodo</dt>
          <dd className="tabular">{centsToLabel(datos.promoTotalCents)}</dd>
        </div>
        {/* 🔴 El desglose sólo se pinta si la base por 1.16 devuelve el total.
            Cuando no cuadra (el caso de $22.00, cuya base de dos decimales da
            $22.01), se dice en vez de imprimir una cuenta que el CFDI no puede
            sostener. Cuál es el precio lo decide la campaña, no esta pantalla. */}
        {exacto ? (
          <div className="flex justify-between gap-2 sm:col-span-2">
            <dt>Desglose del cobro promocional</dt>
            <dd className="tabular">
              {centsToLabel(datos.promo.subtotalCents)} + {centsToLabel(datos.promo.ivaCents)} de
              IVA
            </dd>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <p className="text-[12px] text-[var(--warn)]">
              Este total no se puede desglosar exacto con dos decimales: la base por 1.16 no
              devuelve {centsToLabel(datos.firstChargeCents)}. Se cobra ese total; la factura
              necesita una base con más decimales, o un precio que sí cuadre.
            </p>
          </div>
        )}
        {cuponId && (
          <div className="flex justify-between gap-2 sm:col-span-2">
            <dt>Cupón que se creará</dt>
            <dd className="tabular">{cuponId}</dd>
          </div>
        )}
      </dl>
      {datos.problems.length > 0 && (
        <ul className="space-y-1 rounded-[6px] bg-[var(--danger-faint)] px-3 py-2 text-[12.5px] text-[var(--danger)]">
          {datos.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Cómo se verá /oferta/<slug> en la landing.
 *
 * Réplica del hero de `avoqado-landing/src/pages/oferta/[codigo].astro`: el mismo orden de
 * bloques, los mismos textos fijos y el MISMO título de respaldo cuando el encabezado va vacío.
 *
 * 🔴 Es una RÉPLICA, no la página real. La landing es Astro y esto React: no hay render
 * compartido, así que si aquel hero cambia, hay que mover éste con él. Se acepta esa deuda
 * porque ver el precio en grande ANTES de activar es justo lo que evita el error que ya costó
 * una ficha: POS22 nació a $25.52 porque «Precio anunciado (con IVA)» se leyó como «+ IVA»,
 * y una ficha activada NO puede corregir su precio (`camposBloqueados` lo congela).
 */
function VistaPreviaDeLaPagina({
  planTier,
  precioTexto,
  meses,
  renovacionCents,
  headline,
  subheadline,
  bullets,
  slug,
}: {
  planTier: string
  precioTexto: string
  meses: number
  renovacionCents?: number
  headline: string
  subheadline: string
  bullets: string[]
  slug: string
}) {
  // 🔴 `pesosInputToCents` LANZA con el campo vacío o a medio teclear, y esto se pinta en cada
  // render del formulario: sin este catch, la vista previa tumba el editor entero.
  let precioCents = 0
  try {
    precioCents = pesosInputToCents(precioTexto)
  } catch {
    precioCents = 0
  }

  const plan = planTier === 'PREMIUM' ? 'Premium' : 'Pro'
  const precio = centsToLabel(precioCents)
  // El mismo respaldo que arma la landing cuando `headline` viene vacío.
  const titulo = headline.trim() || `Avoqado ${plan} a ${precio}/mes`
  const puntos = bullets.map((p) => p.trim()).filter(Boolean)

  if (!Number.isFinite(precioCents) || precioCents <= 0) {
    return (
      <p className="rounded-[8px] border border-dashed border-[var(--line-strong)] px-3.5 py-3 text-[13px] text-[var(--ink-faint)]">
        Pon el precio anunciado para ver la página.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-[8px] border border-[var(--line-strong)]">
      <p className="border-b border-[var(--line-strong)] bg-[var(--canvas-raised)] px-3.5 py-2 text-[11.5px] text-[var(--ink-faint)]">
        avoqado.io/oferta/{slug.trim() || '…'}
      </p>
      <div className="space-y-3 px-3.5 py-3.5">
        <p className="text-[11.5px] uppercase tracking-wide text-[var(--ink-muted)]">
          Avoqado {plan}
        </p>
        <p className="text-[19px] font-medium leading-snug text-[var(--ink)]">{titulo}</p>
        {subheadline.trim() && (
          <p className="text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
            {subheadline.trim()}
          </p>
        )}
        <div>
          <p className="tabular text-[32px] font-medium leading-none text-[var(--ink)]">{precio}</p>
          <p className="mt-1.5 text-[11.5px] text-[var(--ink-muted)]">
            IVA incluido · por {meses} {meses === 1 ? 'mes' : 'meses'}
            {renovacionCents ? ` · después ${centsToLabel(renovacionCents)}/mes` : ''} · con tarjeta
            · cancela cuando quieras
          </p>
        </div>
        {puntos.length > 0 && (
          <ul className="space-y-1.5">
            {puntos.map((p) => (
              <li key={p} className="relative pl-4 text-[13px] text-[var(--ink)]">
                <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {p}
              </li>
            ))}
          </ul>
        )}
        <div>
          <span className="inline-block rounded-[6px] bg-[var(--accent)] px-3.5 py-2 text-[13px] font-medium text-[var(--on-accent,#fff)]">
            Empezar con {precio}
          </span>
          <p className="mt-1.5 text-[11.5px] text-[var(--ink-faint)]">
            Se paga con tarjeta. Cancela cuando quieras, desde tu panel.
          </p>
        </div>
      </div>
    </div>
  )
}
