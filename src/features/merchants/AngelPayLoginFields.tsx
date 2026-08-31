import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Combobox } from '@/shared/ui/Combobox'
import { inspectApiError } from '@/shared/lib/api-error'
import { toast } from 'sonner'
import { useRevealAngelPayPin } from './use-merchants'
import {
  angelpayLoginIsEditable,
  humanizeAngelPayEnvironment,
  humanizeAngelPayStatus,
  type MerchantAngelPayAccount,
} from './types'

const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--ink-muted)]'
const inputCls =
  'h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 text-[14px] ' +
  'placeholder:text-[var(--ink-faint)] focus-visible:border-[var(--accent)] focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60'

interface Props {
  account: MerchantAngelPayAccount | null
  email: string
  environment: string
  newPin: string
  onChange: (patch: { email?: string; environment?: string; newPin?: string }) => void
}

/**
 * El login de AngelPay del merchant: correo, ambiente y PIN.
 *
 * Dos reglas que vienen del backend y que la pantalla tiene que DECIR en vez de
 * dejar que el operador se estrelle contra un 400:
 *
 *  1. **El correo y el ambiente sólo se cambian antes de fijar el PIN**
 *     (`status === 'PENDING_PIN'`). Después AngelPay ya validó esa identidad y
 *     cambiarla aquí sólo desincronizaría lo que vemos de lo que hay allá.
 *  2. **El PIN no viaja solo.** Ninguna respuesta lo trae; se pide a un endpoint
 *     aparte que registra la lectura. Por eso se revela con un clic y nunca al
 *     abrir el editor: si se cargara solo, cada vez que alguien abre esta
 *     pantalla quedaría una lectura de credencial en la bitácora.
 */
export function AngelPayLoginFields({ account, email, environment, newPin, onChange }: Props) {
  const reveal = useRevealAngelPayPin()
  const [shownPin, setShownPin] = useState<string | null>(null)

  if (!account) {
    return (
      <p className="text-[12.5px] text-[var(--ink-faint)]">
        Esta cuenta no está atada a ningún login de AngelPay. Se vincula desde el alta guiada.
      </p>
    )
  }

  const editable = angelpayLoginIsEditable(account.status)

  function handleReveal() {
    if (shownPin !== null) {
      setShownPin(null)
      return
    }
    reveal.mutate(account!.id, {
      onSuccess: (pin) => setShownPin(pin ?? '— sin PIN todavía —'),
      onError: (err) => {
        const i = inspectApiError(err, 'leer el PIN')
        toast.error(i.title, { description: i.description })
      },
    })
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--ink-faint)]">Estado</span>
        <Badge tone={account.status === 'ACTIVE' ? 'success' : 'warn'} size="sm">
          {humanizeAngelPayStatus(account.status)}
        </Badge>
      </div>

      <div>
        <label className={labelCls} htmlFor="ap-email">
          Correo de la cuenta
        </label>
        <input
          id="ap-email"
          className={inputCls}
          type="email"
          value={email}
          disabled={!editable}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>

      <div>
        <span className={labelCls}>Ambiente</span>
        {editable ? (
          <Combobox
            value={environment}
            onChange={(v) => onChange({ environment: v })}
            options={[
              { value: 'PROD', label: 'Producción', description: 'Cobra de verdad' },
              { value: 'QA', label: 'QA', description: 'Pruebas' },
            ]}
            placeholder="Sin ambiente"
            ariaLabel="Ambiente de la cuenta AngelPay"
          />
        ) : (
          <input
            className={inputCls}
            value={humanizeAngelPayEnvironment(environment)}
            disabled
            readOnly
            aria-label="Ambiente"
          />
        )}
      </div>

      <div>
        <span className={labelCls}>PIN actual</span>
        <div className="flex items-center gap-2">
          <input
            className={inputCls + ' tabular-nums'}
            value={shownPin ?? '••••••'}
            disabled
            readOnly
            aria-label="PIN actual"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={reveal.isPending}
            onClick={handleReveal}
          >
            {shownPin !== null ? (
              <>
                <EyeOff className="h-3.5 w-3.5" aria-hidden /> Ocultar
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" aria-hidden /> {reveal.isPending ? 'Leyendo…' : 'Ver'}
              </>
            )}
          </Button>
        </div>
        <p className="mt-1 text-[11.5px] text-[var(--ink-faint)]">
          Verlo queda registrado en la bitácora.
        </p>
      </div>

      <div>
        <label className={labelCls} htmlFor="ap-newpin">
          Nuevo PIN (6 dígitos)
        </label>
        <input
          id="ap-newpin"
          className={inputCls + ' tabular-nums'}
          inputMode="numeric"
          autoComplete="off"
          value={newPin}
          placeholder="Déjalo en blanco para no cambiarlo"
          onChange={(e) => onChange({ newPin: e.target.value })}
        />
      </div>

      {!editable && (
        <p className="text-[11.5px] text-[var(--ink-faint)]">
          El correo y el ambiente ya no se pueden cambiar: se fijan al crear la cuenta y AngelPay ya
          validó esta identidad. El PIN sí se puede rotar cuando quieras.
        </p>
      )}
    </>
  )
}
