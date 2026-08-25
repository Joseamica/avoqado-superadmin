import { useCallback, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Brandmark } from '@/shared/components/Brandmark'
import { Button } from '@/shared/ui/Button'
import { Field } from '@/shared/ui/Field'
import { useAuth } from '@/features/auth/use-auth'
import { useGoogleIdentity } from '@/features/auth/use-google-identity'
import { readApiErrorMessage } from '@/shared/lib/api'
import * as authService from '@/features/auth/api'
import { hasSuperadminRole } from '@/features/auth/api'
import { useQueryClient } from '@tanstack/react-query'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login, loginWithGoogle, logout, isAuthenticated, isSuperadmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  /**
   * Puerta común a las dos formas de entrar (contraseña y Google).
   *
   * El cookie ya quedó seteado por el login. La SOURCE OF TRUTH del rol vive en
   * `/dashboard/auth/status` (el backend devuelve `user.role` con el
   * `highestRole` calculado). Le pegamos directo al servicio — no a través de
   * `queryClient.fetchQuery` — para evitar la race contra el refetch del
   * provider (esa race tiraba `CancelledError` y mostraba un toast de error
   * aunque el login funcionara). Después actualizamos la cache para que
   * ProtectedRoute lo lea fresco sin re-pegarle al server.
   *
   * Un login exitoso NO implica acceso: cualquier Staff de cualquier venue
   * puede autenticarse contra este endpoint. El rol se verifica aquí y, si no
   * es superadmin, cerramos la sesión en el acto — así no entra al
   * ProtectedRoute y no vemos el flash de "acceso denegado".
   */
  const enterConsole = useCallback(async (): Promise<void> => {
    const fresh = await authService.getAuthStatus()
    queryClient.setQueryData(['auth', 'status'], fresh)

    if (!hasSuperadminRole(fresh.user)) {
      await logout()
      setAccessError('Esta cuenta no tiene permisos de superadmin. Pide a ops que te eleve el rol.')
      return
    }

    navigate('/dashboard', { replace: true })
  }, [logout, navigate, queryClient])

  const handleGoogleCredential = useCallback(
    async (credential: string): Promise<void> => {
      setGoogleSubmitting(true)
      setAccessError(null)
      try {
        await loginWithGoogle(credential)
        await enterConsole()
      } catch (error) {
        toast.error('No pudimos entrar con Google', {
          description: readApiErrorMessage(
            error,
            'Esa cuenta de Google no está dada de alta en Avoqado.',
          ),
        })
      } finally {
        setGoogleSubmitting(false)
      }
    },
    [enterConsole, loginWithGoogle],
  )

  const {
    status: googleStatus,
    containerRef: googleButtonRef,
    retry: retryGoogle,
  } = useGoogleIdentity({
    onCredential: (credential) => void handleGoogleCredential(credential),
    disabled: isAuthenticated,
  })

  if (isAuthenticated && isSuperadmin) {
    const redirectTo =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    setAccessError(null)
    try {
      await login(values)
      await enterConsole()
    } catch (error) {
      toast.error('No pudimos iniciar sesión', {
        description: readApiErrorMessage(error, 'Verifica tus credenciales.'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || googleSubmitting

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--canvas)] lg:grid-cols-[1fr_520px]">
      <aside className="hidden flex-col justify-between border-r border-[var(--line)] bg-[var(--canvas-sunken)] p-12 lg:flex">
        <Brandmark />
        <div className="max-w-[420px]">
          <p className="eyebrow text-[var(--accent)]">Restringido</p>
          <h2 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.026em] text-[var(--ink)]">
            Consola interna de operaciones para el equipo Avoqado.
          </h2>
          <p className="mt-3 max-w-[380px] text-[14.5px] leading-relaxed text-[var(--ink-muted)]">
            Acceso solo para personal autorizado. Cada sesión queda registrada en el activity log,
            incluida la IP y el dispositivo de origen.
          </p>
        </div>
        <p className="font-mono text-[11px] text-[var(--ink-faint)]">
          v0.1 · {new Date().getFullYear()}
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 lg:hidden">
            <Brandmark />
          </div>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)]">
            Iniciar sesión
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--ink-muted)]">
            Usa tu correo corporativo Avoqado.
          </p>

          {accessError && (
            <div
              role="alert"
              className="mt-5 rounded-[6px] border border-[var(--danger)]/40 bg-[var(--danger-faint)] px-3.5 py-3 text-[12.5px] leading-snug text-[var(--danger)]"
            >
              <p className="font-semibold">Acceso denegado</p>
              <p className="mt-0.5 text-[var(--ink-muted)]">{accessError}</p>
            </div>
          )}

          {/*
            `noValidate` desactiva la validación nativa del browser para que
            zod (via react-hook-form) sea la única autoridad. Sin esto, un
            `<input type="email">` con valor inválido bloquea el submit con
            popup nativo del browser y nuestra validación tipada nunca corre
            — el usuario ve el aviso nativo en lugar del nuestro, y el
            mensaje varía entre browsers. Con `noValidate`, zod corre
            siempre y vemos "Email inválido" consistente.
          */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="jose@avoqado.io"
              error={errors.email?.message}
              {...register('email')}
            />
            <Field
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <Button type="submit" disabled={busy} className="w-full">
              {submitting ? 'Entrando…' : 'Entrar a la consola'}
            </Button>
          </form>

          {/*
            El botón de Google lo dibuja Google dentro de este contenedor (ver
            `use-google-identity.ts`). Toda la sección desaparece si no hay
            `VITE_GOOGLE_CLIENT_ID` configurado — sin client ID el botón no
            puede funcionar, y un botón muerto es peor que ninguno.
          */}
          {googleStatus !== 'disabled' && (
            <section aria-label="Acceso con Google" className="mt-7">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden="true" />
                <span className="label text-[var(--ink-muted)]">o</span>
                <span className="h-px flex-1 bg-[var(--line)]" aria-hidden="true" />
              </div>

              <div className="mt-5">
                {/* Altura reservada: sin esto el layout salta cuando Google
                    inyecta su iframe. */}
                <div
                  ref={googleButtonRef}
                  aria-busy={googleSubmitting}
                  className={`flex min-h-[40px] justify-center ${
                    busy ? 'pointer-events-none opacity-60' : ''
                  }`}
                />

                {googleStatus === 'loading' && (
                  <p className="mt-2 text-center text-[12px] text-[var(--ink-muted)]">
                    Cargando el acceso con Google…
                  </p>
                )}

                {googleStatus === 'error' && (
                  <div className="text-center">
                    <p className="text-[12px] leading-snug text-[var(--ink-muted)]">
                      No cargó el botón de Google. Suele ser un bloqueador de anuncios o la red.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      className="mt-2"
                      onClick={retryGoogle}
                    >
                      Reintentar
                    </Button>
                  </div>
                )}

                {googleSubmitting && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 text-center text-[12px] text-[var(--ink-muted)]"
                  >
                    Verificando tu cuenta de Google…
                  </p>
                )}
              </div>
            </section>
          )}

          <p className="mt-8 text-[11px] text-[var(--ink-faint)]">
            ¿Problemas para entrar? Escribe a{' '}
            <a
              href="mailto:hola@avoqado.io"
              className="border-b border-dashed border-[var(--ink-faint)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              hola@avoqado.io
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
