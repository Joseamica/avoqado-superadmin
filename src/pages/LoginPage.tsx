import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Brandmark } from '@/components/Brandmark'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { readApiErrorMessage } from '@/lib/api'
import { hasSuperadminRole } from '@/services/auth.service'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { login, logout, isAuthenticated, isSuperadmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
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
      const response = await login(values)

      // El login server-side aceptó el cookie, pero antes de entrar a la consola
      // verificamos que el usuario tenga rol SUPERADMIN. Si no, cerramos sesión
      // para limpiar el cookie y mostramos el error in-place — no redirect al gate.
      if (!hasSuperadminRole(response.staff)) {
        await logout()
        setAccessError(
          'Esta cuenta no tiene permisos de superadmin. Pide a ops que te eleve el rol.',
        )
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (error) {
      toast.error('No pudimos iniciar sesión', {
        description: readApiErrorMessage(error, 'Verifica tus credenciales.'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--canvas)] lg:grid-cols-[1fr_520px]">
      <aside className="hidden flex-col justify-between border-r border-[var(--line)] bg-[var(--canvas-sunken)] p-12 lg:flex">
        <Brandmark />
        <div className="max-w-[420px]">
          <p className="eyebrow text-[var(--accent)]">Restringido</p>
          <h2 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.026em] text-[var(--ink)]">
            Consola interna de operaciones para el equipo Avoqado.
          </h2>
          <p className="mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-[var(--ink-muted)]">
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
          <p className="mt-1.5 text-[13px] text-[var(--ink-muted)]">
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

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
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
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Entrando…' : 'Entrar a la consola'}
            </Button>
          </form>

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
