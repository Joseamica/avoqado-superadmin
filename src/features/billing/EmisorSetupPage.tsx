import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, ShieldCheck, UploadCloud } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { buttonVariants } from '@/shared/ui/button-variants'
import { Field } from '@/shared/ui/Field'
import { Checkbox } from '@/shared/ui/Checkbox'
import { Combobox } from '@/shared/ui/Combobox'
import { QueryError } from '@/shared/components/QueryError'
import { formatDate } from '@/shared/lib/datetime'
import { useEmisor, useEmisorActions } from './use-billing'
import { REGIMEN_FISCAL_OPTIONS, USO_CFDI_OPTIONS } from './catalogs'
import { CSD_STATUS_TONE, humanizeCsdStatus } from './types'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const fileInputCls =
  'block w-full cursor-pointer rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 py-2 text-[13px] text-[var(--ink)] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[var(--canvas-raised)] file:px-2.5 file:py-1 file:text-[12px] file:text-[var(--ink)]'

export function EmisorSetupPage() {
  const emisor = useEmisor()
  const { save, provision, uploadCsd } = useEmisorActions()

  // Legal form
  const [rfc, setRfc] = useState('')
  const [legalName, setLegalName] = useState('')
  const [regimenFiscal, setRegimenFiscal] = useState('601')
  const [lugarExpedicion, setLugarExpedicion] = useState('')
  const [serie, setSerie] = useState('A')
  const [defaultUsoCfdi, setDefaultUsoCfdi] = useState('')

  // Provisioning (manual)
  const [manual, setManual] = useState(false)
  const [providerOrgId, setProviderOrgId] = useState('')
  const [liveKey, setLiveKey] = useState('')

  // CSD
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [csdPassword, setCsdPassword] = useState('')

  // Hydrate the legal form once the emisor loads.
  useEffect(() => {
    const e = emisor.data
    if (!e) return
    setRfc(e.rfc)
    setLegalName(e.legalName)
    setRegimenFiscal(e.regimenFiscal)
    setLugarExpedicion(e.lugarExpedicion)
    setSerie(e.serie)
    setDefaultUsoCfdi(e.defaultUsoCfdi ?? '')
  }, [emisor.data])

  const legalValid =
    rfc.trim().length >= 12 &&
    legalName.trim() &&
    /^\d{3}$/.test(regimenFiscal) &&
    /^\d{5}$/.test(lugarExpedicion)

  const handleSaveLegal = () => {
    if (!legalValid) return
    save.mutate({
      rfc: rfc.trim().toUpperCase(),
      legalName: legalName.trim(),
      regimenFiscal,
      lugarExpedicion: lugarExpedicion.trim(),
      serie: serie.trim() || 'A',
      defaultUsoCfdi: defaultUsoCfdi || undefined,
    })
  }

  const handleProvision = () => {
    if (manual) {
      if (!providerOrgId.trim() || !liveKey.trim()) return
      provision.mutate({ providerOrgId: providerOrgId.trim(), liveKey: liveKey.trim() })
    } else {
      provision.mutate({})
    }
  }

  const handleUploadCsd = async () => {
    if (!cerFile || !keyFile || !csdPassword) return
    const [cerBase64, keyBase64] = await Promise.all([fileToBase64(cerFile), fileToBase64(keyFile)])
    uploadCsd.mutate({ cerBase64, keyBase64, csdPassword })
  }

  const e = emisor.data
  const provisioned = Boolean(e?.providerOrgId)

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 md:px-8 lg:px-10 lg:py-10">
      <Link to="/billing" className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' mb-4'}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a facturas
      </Link>

      <header className="mb-7">
        <p className="eyebrow">Facturación</p>
        <h1 className="mt-1.5 font-display text-[28px] font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-[32px]">
          Emisor Avoqado
        </h1>
        <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
          Los datos fiscales, la organización en Facturapi y el sello digital (CSD) con los que
          Avoqado timbra a sus clientes.
        </p>
      </header>

      {emisor.isError && (
        <QueryError
          className="mb-5"
          error={emisor.error}
          context="cargar el emisor"
          onRetry={() => emisor.refetch()}
        />
      )}

      {/* Status */}
      <section className="mb-6 flex flex-wrap items-center gap-3 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-4">
        <ShieldCheck className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone={CSD_STATUS_TONE[e?.csdStatus ?? 'NONE']}>
            {humanizeCsdStatus(e?.csdStatus ?? 'NONE')}
          </Badge>
          <Badge tone={provisioned ? 'success' : 'muted'} size="sm">
            {provisioned ? 'Provisionado en Facturapi' : 'Sin provisionar'}
          </Badge>
          {e?.keyConfigured && (
            <Badge tone="success" size="sm">
              Llave configurada
            </Badge>
          )}
          {e?.csdExpiresAt && (
            <span className="tabular text-[var(--ink-muted)]">
              CSD vence {formatDate(e.csdExpiresAt)}
            </span>
          )}
        </div>
      </section>

      {/* 1. Legal data */}
      <section className="mb-6 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
        <h2 className="mb-4 font-display text-[16px] font-semibold text-[var(--ink)]">
          1 · Datos fiscales
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="RFC"
            name="rfc"
            value={rfc}
            onChange={(ev) => setRfc(ev.target.value)}
            hint="12 (moral) o 13 (física) caracteres"
          />
          <Field
            label="Razón social"
            name="legalName"
            value={legalName}
            onChange={(ev) => setLegalName(ev.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
              Régimen fiscal
            </label>
            <Combobox
              value={regimenFiscal}
              onChange={setRegimenFiscal}
              options={REGIMEN_FISCAL_OPTIONS}
              ariaLabel="Régimen fiscal"
            />
          </div>
          <Field
            label="Lugar de expedición (CP)"
            name="cp"
            value={lugarExpedicion}
            onChange={(ev) => setLugarExpedicion(ev.target.value)}
            hint="5 dígitos"
          />
          <Field
            label="Serie"
            name="serie"
            value={serie}
            onChange={(ev) => setSerie(ev.target.value)}
            hint="Default de la serie del comprobante"
          />
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
              Uso CFDI por defecto (opcional)
            </label>
            <Combobox
              value={defaultUsoCfdi}
              onChange={setDefaultUsoCfdi}
              options={USO_CFDI_OPTIONS}
              ariaLabel="Uso CFDI por defecto"
              placeholder="Sin default"
            />
          </div>
        </div>
        <div className="mt-5">
          <Button onClick={handleSaveLegal} disabled={!legalValid || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar datos fiscales'}
          </Button>
        </div>
      </section>

      {/* 2. Provisioning */}
      <section className="mb-6 rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
        <h2 className="mb-1 font-display text-[16px] font-semibold text-[var(--ink)]">
          2 · Organización en Facturapi
        </h2>
        <p className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Crea la organización de Avoqado en Facturapi, o pega una que ya hayas creado en el panel.
        </p>
        {provisioned && (
          <div className="mb-4 rounded-[6px] border border-[var(--line)] bg-[var(--canvas-raised)] px-3.5 py-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--ink-muted)]">Organización:</span>
              <code className="tabular rounded bg-[var(--canvas)] px-1.5 py-0.5 text-[12px] text-[var(--ink)]">
                {e?.providerOrgId}
              </code>
              {e?.keyConfigured ? (
                <Badge tone="success" size="sm">
                  Llave configurada ✓
                </Badge>
              ) : (
                <Badge tone="warn" size="sm">
                  Sin llave
                </Badge>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--ink-faint)]">
              Por seguridad, la llave nunca se muestra. Solo vuelve a pegarla si necesitas
              reemplazarla.
            </p>
          </div>
        )}
        <label className="mb-4 flex items-center gap-2.5 text-[13px] text-[var(--ink)]">
          <Checkbox checked={manual} onCheckedChange={(v) => setManual(Boolean(v))} />
          {provisioned
            ? 'Reemplazar org id + live key'
            : 'Ya tengo org id + live key (pegar manual)'}
        </label>
        {manual && (
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Provider org id"
              name="orgId"
              value={providerOrgId}
              onChange={(ev) => setProviderOrgId(ev.target.value)}
            />
            <Field
              label="Live key (sk_live_…)"
              name="liveKey"
              type="password"
              value={liveKey}
              onChange={(ev) => setLiveKey(ev.target.value)}
            />
          </div>
        )}
        <Button
          variant="secondary"
          onClick={handleProvision}
          disabled={
            !e || provision.isPending || (manual && (!providerOrgId.trim() || !liveKey.trim()))
          }
        >
          {provision.isPending
            ? 'Procesando…'
            : manual
              ? provisioned
                ? 'Reemplazar org/key'
                : 'Vincular org/key'
              : 'Provisionar en Facturapi'}
        </Button>
      </section>

      {/* 3. CSD */}
      <section className="rounded-[8px] border border-[var(--line-strong)] bg-[var(--canvas)] p-5">
        <h2 className="mb-1 flex items-center gap-2 font-display text-[16px] font-semibold text-[var(--ink)]">
          <KeyRound className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> 3 · Sello digital
          (CSD)
        </h2>
        <p className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Sube los archivos .cer y .key del CSD de Avoqado y su contraseña. Requiere haber
          provisionado primero.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
              Certificado (.cer)
            </label>
            <input
              type="file"
              accept=".cer"
              className={fileInputCls}
              onChange={(ev) => setCerFile(ev.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">
              Llave privada (.key)
            </label>
            <input
              type="file"
              accept=".key"
              className={fileInputCls}
              onChange={(ev) => setKeyFile(ev.target.files?.[0] ?? null)}
            />
          </div>
          <Field
            label="Contraseña del CSD"
            name="csdPassword"
            type="password"
            value={csdPassword}
            onChange={(ev) => setCsdPassword(ev.target.value)}
          />
        </div>
        <div className="mt-5">
          <Button
            onClick={handleUploadCsd}
            disabled={!provisioned || !cerFile || !keyFile || !csdPassword || uploadCsd.isPending}
          >
            <UploadCloud className="h-4 w-4" aria-hidden />{' '}
            {uploadCsd.isPending ? 'Subiendo…' : 'Subir CSD'}
          </Button>
          {!provisioned && (
            <p className="mt-2 text-[12px] text-[var(--warn)]">
              Primero provisiona la organización en Facturapi.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
