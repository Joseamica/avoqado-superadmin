import { useState } from 'react'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
} from '@/shared/ui/Drawer'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { inspectApiError } from '@/shared/lib/api-error'
import { useCreateMerchant, useProviders, useUpdateMerchant } from './use-merchants'
import type { MerchantAccount } from './types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, es modo editar. Si no, alta. */
  merchant?: MerchantAccount
  onSaved?: (m: MerchantAccount) => void
}

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'
const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

export function MerchantIdentityDrawer({ open, onOpenChange, merchant, onSaved }: Props) {
  const isEdit = !!merchant
  const providersQ = useProviders()
  const createM = useCreateMerchant()
  const updateM = useUpdateMerchant()

  const [providerId, setProviderId] = useState(merchant?.provider.id ?? '')
  const [externalMerchantId, setExternalMerchantId] = useState(merchant?.externalMerchantId ?? '')
  const [displayName, setDisplayName] = useState(merchant?.displayName ?? '')
  const [alias, setAlias] = useState(merchant?.alias ?? '')
  const [merchantIdCred, setMerchantIdCred] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)

  const saving = createM.isPending || updateM.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isEdit && merchant) {
      const schema = z.object({
        externalMerchantId: z.string().min(1, 'El ID externo es obligatorio'),
        displayName: z.string().optional(),
        alias: z.string().optional(),
      })
      const parsed = schema.safeParse({ externalMerchantId, displayName, alias })
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')

      updateM.mutate(
        {
          id: merchant.id,
          input: {
            externalMerchantId,
            displayName: displayName || null,
            alias: alias || null,
          },
        },
        {
          onSuccess: (m) => {
            toast.success('Cuenta actualizada')
            onSaved?.(m)
            onOpenChange(false)
          },
          onError: (err) => {
            const i = inspectApiError(err, 'actualizar la cuenta')
            setError(i.description)
            toast.error(i.title, { description: i.description })
          },
        },
      )
      return
    }

    // Create mode
    const schema = z.object({
      providerId: z.string().min(1, 'Elige un proveedor'),
      externalMerchantId: z.string().min(1, 'El ID externo es obligatorio'),
      merchantIdCred: z.string().min(1, 'merchantId de credenciales es obligatorio'),
      apiKey: z.string().min(1, 'apiKey es obligatorio'),
    })
    const parsed = schema.safeParse({ providerId, externalMerchantId, merchantIdCred, apiKey })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')

    createM.mutate(
      {
        providerId,
        externalMerchantId,
        displayName: displayName || null,
        alias: alias || null,
        credentials: { merchantId: merchantIdCred, apiKey },
      },
      {
        onSuccess: (m) => {
          toast.success('Cuenta creada')
          onSaved?.(m)
          onOpenChange(false)
        },
        onError: (err) => {
          const i = inspectApiError(err, 'crear la cuenta')
          setError(i.description)
          toast.error(i.title, { description: i.description })
        },
      },
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{isEdit ? 'Editar identidad' : 'Alta manual de cuenta'}</DrawerTitle>
          <DrawerSubtitle>
            {isEdit ? 'El proveedor no se puede cambiar.' : 'Crea una cuenta de pago manualmente.'}
          </DrawerSubtitle>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerBody>
            <div className="flex flex-col gap-4">
              {!isEdit && (
                <div>
                  <label className={labelCls}>Proveedor</label>
                  <Combobox
                    value={providerId}
                    onChange={setProviderId}
                    options={(providersQ.data ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.code,
                    }))}
                    placeholder="Elige un proveedor"
                    ariaLabel="Proveedor"
                  />
                </div>
              )}

              <div>
                <label className={labelCls} htmlFor="extId">
                  ID externo del merchant
                </label>
                <input
                  id="extId"
                  className={inputCls}
                  value={externalMerchantId}
                  onChange={(e) => setExternalMerchantId(e.target.value)}
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="dn">
                  Nombre visible
                </label>
                <input
                  id="dn"
                  className={inputCls}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Cuenta Principal"
                />
              </div>

              <div>
                <label className={labelCls} htmlFor="al">
                  Alias
                </label>
                <input
                  id="al"
                  className={inputCls}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </div>

              {!isEdit && (
                <fieldset className="flex flex-col gap-3 rounded-[8px] border border-[var(--line)] p-3">
                  <legend className="px-1 text-[12px] font-medium text-[var(--ink-muted)]">
                    Credenciales
                  </legend>
                  <div>
                    <label className={labelCls} htmlFor="cmid">
                      merchantId
                    </label>
                    <input
                      id="cmid"
                      className={inputCls}
                      value={merchantIdCred}
                      onChange={(e) => setMerchantIdCred(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cak">
                      apiKey
                    </label>
                    <input
                      id="cak"
                      className={inputCls}
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </fieldset>
              )}

              {error && (
                <p className="text-[13px] text-[var(--danger)]" role="alert">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear cuenta'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
