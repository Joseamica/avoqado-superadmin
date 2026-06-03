import { useMemo, useState, type ReactNode } from 'react'
import { Loader2, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox'
import { IconButton } from '@/shared/ui/IconButton'
import { QueryError } from '@/shared/components/QueryError'
import { cn } from '@/shared/lib/utils'
import { inspectApiError } from '@/shared/lib/api-error'
import type { AccessCandidate, StaffRole, VenueAccessGrant } from './api'
import { ASSIGNABLE_ROLES, ROLE_LABEL_ES } from './role-labels'
import { useGrantVenueAccess, useVenueAccessCandidates } from './use-venue-access'

/**
 * Paso "Dar acceso a una persona" — el núcleo del carry-over de staff cuando
 * se migra una terminal de un venue a otro.
 *
 * Cuando una TPV se mueve de A → B, las personas que la usaban en A pierden el
 * login (el PIN es por-venue). Este paso deja que el operador les dé acceso en
 * el destino: elige a la persona, le asigna un rol y un PIN. Sirve en dos
 * contextos:
 *
 *   - **Dentro del wizard de migración** (con `sourceVenueId`): las personas
 *     que usaban la terminal aparecen primero, marcadas, con su rol y un PIN
 *     sugerido pre-cargados. Dar acceso aquí hace que el preflight pase el
 *     blocker `NO_STAFF_PIN`.
 *   - **Standalone** (sin `sourceVenueId`): el picker muestra a toda la
 *     organización sin nada pre-seleccionado — para dar acceso en cualquier
 *     momento.
 *
 * UX para un operador no-técnico: cada persona agregada muestra una frase plana
 * ("Le vas a dar acceso a X como Mesero con PIN 1234") para que entienda
 * exactamente qué va a pasar antes de confirmar.
 */

const DEFAULT_ROLE: StaffRole = 'WAITER'

interface StaffAccessStepProps {
  /** Venue donde se otorga el acceso (el destino de la migración, o el venue de la terminal). */
  destVenueId: string
  /** Venue origen — sólo en el flujo de migración. Marca a quién usaba la terminal. */
  sourceVenueId?: string
  destVenueName?: string | null
  /** Se llama tras un grant exitoso. */
  onDone: () => void
  /** Se llama al omitir el paso (sin otorgar nada). */
  onSkip: () => void
}

/** Fila editable: una persona seleccionada con su rol y PIN. */
interface AccessRow {
  staffId: string
  role: StaffRole
  pin: string
}

export function StaffAccessStep({
  destVenueId,
  sourceVenueId,
  destVenueName,
  onDone,
  onSkip,
}: StaffAccessStepProps) {
  const candidatesQuery = useVenueAccessCandidates(destVenueId, sourceVenueId)
  const grantMutation = useGrantVenueAccess()

  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data])

  const candidatesById = useMemo(() => {
    const map = new Map<string, AccessCandidate>()
    for (const c of candidates) map.set(c.staffId, c)
    return map
  }, [candidates])

  // Filas seleccionadas. Empieza vacío — el operador agrega a quién quiera dar
  // acceso. Por intención NO auto-seleccionamos a todos los del origen: el
  // operador decide caso por caso (puede que algunos ya no trabajen ahí).
  const [rows, setRows] = useState<AccessRow[]>([])

  const selectedIds = useMemo(() => new Set(rows.map((r) => r.staffId)), [rows])

  // Opciones del picker — los del venue origen primero (los que perdieron
  // acceso), luego el resto. Los ya agregados se ocultan.
  const pickerOptions: ComboboxOption[] = useMemo(() => {
    return candidates
      .filter((c) => !selectedIds.has(c.staffId))
      .slice()
      .sort((a, b) => {
        if (a.inSourceVenue !== b.inSourceVenue) return a.inSourceVenue ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .map((c) => ({
        value: c.staffId,
        label: c.name,
        description: c.inSourceVenue
          ? `${c.email} · usaba esta terminal`
          : c.alreadyAtDestination
            ? `${c.email} · ya tiene acceso`
            : c.email,
        searchTokens: c.email,
      }))
  }, [candidates, selectedIds])

  function defaultRoleFor(c: AccessCandidate): StaffRole {
    return c.currentRoleAtSource ?? c.currentRoleAtDestination ?? DEFAULT_ROLE
  }

  function addPerson(staffId: string) {
    const c = candidatesById.get(staffId)
    if (!c) return
    setRows((prev) => {
      if (prev.some((r) => r.staffId === staffId)) return prev
      return [...prev, { staffId, role: defaultRoleFor(c), pin: c.suggestedPin ?? '' }]
    })
  }

  function removePerson(staffId: string) {
    setRows((prev) => prev.filter((r) => r.staffId !== staffId))
  }

  function setRole(staffId: string, role: StaffRole) {
    setRows((prev) => prev.map((r) => (r.staffId === staffId ? { ...r, role } : r)))
  }

  function setPin(staffId: string, pin: string) {
    // Sólo dígitos, máximo 6.
    const clean = pin.replace(/\D/g, '').slice(0, 6)
    setRows((prev) => prev.map((r) => (r.staffId === staffId ? { ...r, pin: clean } : r)))
  }

  function handleGrant() {
    if (rows.length === 0) {
      toast.error('Agrega al menos una persona o usa "Omitir".')
      return
    }
    // Validación de PIN local: si hay PIN, debe ser 4-6 dígitos.
    const invalid = rows.find((r) => r.pin.length > 0 && (r.pin.length < 4 || r.pin.length > 6))
    if (invalid) {
      const c = candidatesById.get(invalid.staffId)
      toast.error('PIN inválido', {
        description: `El PIN de ${c?.name ?? 'la persona'} debe tener entre 4 y 6 dígitos.`,
      })
      return
    }

    const grants: VenueAccessGrant[] = rows.map((r) => ({
      staffId: r.staffId,
      role: r.role,
      ...(r.pin.length > 0 ? { pin: r.pin } : {}),
    }))

    grantMutation.mutate(
      { venueId: destVenueId, grants },
      {
        onSuccess: () => {
          toast.success(
            rows.length === 1 ? 'Acceso otorgado' : `Acceso otorgado a ${rows.length} personas`,
            {
              description: destVenueName
                ? `Ya pueden entrar en ${destVenueName} con su PIN.`
                : 'Ya pueden entrar con su PIN.',
            },
          )
          onDone()
        },
        onError: (error) => {
          // Los mensajes del server (PIN duplicado / en uso) vienen en español
          // y deben mostrarse verbatim — inspectApiError ya los propaga como
          // `description` para 400/422.
          const info = inspectApiError(error, 'dar acceso a las personas')
          toast.error(info.title, { description: info.description })
        },
      },
    )
  }

  if (candidatesQuery.isError) {
    return (
      <QueryError
        error={candidatesQuery.error}
        context="cargar las personas"
        onRetry={() => candidatesQuery.refetch()}
      />
    )
  }

  return (
    <>
      <Section title="Dar acceso en el destino">
        <p className="text-[12.5px] leading-snug text-[var(--ink-muted)]">
          {sourceVenueId
            ? 'Las personas que usaban esta terminal pierden el acceso al moverla. Dales acceso aquí — un rol y un PIN — para que puedan seguir trabajando.'
            : 'Elige a quién darle acceso en este venue. Cada persona necesita un rol y un PIN para entrar.'}
        </p>

        <div className="mt-2.5">
          <Combobox
            value=""
            onChange={addPerson}
            options={pickerOptions}
            disabled={candidatesQuery.isLoading}
            placeholder={
              candidatesQuery.isLoading ? 'Cargando personas…' : 'Buscar y agregar una persona…'
            }
            searchPlaceholder="Buscar por nombre o correo…"
            emptyLabel={
              candidates.length === 0
                ? 'No hay personas en la organización'
                : 'Sin personas que coincidan'
            }
          />
        </div>
      </Section>

      <Section title={rows.length > 0 ? `Personas con acceso (${rows.length})` : 'Personas'}>
        {rows.length === 0 ? (
          <EmptyRows hasCandidates={candidates.length > 0} loading={candidatesQuery.isLoading} />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const c = candidatesById.get(row.staffId)
              if (!c) return null
              return (
                <PersonRow
                  key={row.staffId}
                  candidate={c}
                  role={row.role}
                  pin={row.pin}
                  onChangeRole={(role) => setRole(row.staffId, role)}
                  onChangePin={(pin) => setPin(row.staffId, pin)}
                  onRemove={() => removePerson(row.staffId)}
                />
              )
            })}
          </ul>
        )}
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          size="lg"
          onClick={onSkip}
          disabled={grantMutation.isPending}
          className="sm:w-auto"
        >
          Omitir
        </Button>
        <Button
          size="lg"
          onClick={handleGrant}
          disabled={rows.length === 0 || grantMutation.isPending}
          className="gap-2 sm:w-auto"
        >
          {grantMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
          )}
          Dar acceso y continuar
        </Button>
      </div>
    </>
  )
}

/* ─── Fila de persona ──────────────────────────────────────────── */

function PersonRow({
  candidate,
  role,
  pin,
  onChangeRole,
  onChangePin,
  onRemove,
}: {
  candidate: AccessCandidate
  role: StaffRole
  pin: string
  onChangeRole: (role: StaffRole) => void
  onChangePin: (pin: string) => void
  onRemove: () => void
}) {
  // Opciones de rol = roles asignables ∪ los que la persona ya tiene (para no
  // perder un rol fuera de la lista estándar).
  const roleOptions: ComboboxOption[] = useMemo(() => {
    const seen = new Set<StaffRole>()
    const ordered: StaffRole[] = []
    for (const r of [...ASSIGNABLE_ROLES, ...candidate.rolesHeld]) {
      if (!seen.has(r)) {
        seen.add(r)
        ordered.push(r)
      }
    }
    return ordered.map((r) => ({
      value: r,
      label: ROLE_LABEL_ES[r],
      description: candidate.rolesHeld.includes(r) ? 'ya lo tiene' : undefined,
      searchTokens: r,
    }))
  }, [candidate.rolesHeld])

  const summary = `Le vas a dar acceso a ${candidate.name} como ${ROLE_LABEL_ES[role]}${
    pin ? ` con PIN ${pin}` : ''
  }.`

  return (
    <li className="rounded-[8px] border border-[var(--line)] bg-[var(--canvas)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{candidate.name}</p>
            {candidate.inSourceVenue && (
              <Badge size="sm" tone="info">
                usaba esta terminal
              </Badge>
            )}
            {candidate.alreadyAtDestination && (
              <Badge size="sm" tone="muted">
                Ya tiene acceso
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--ink-muted)]">{candidate.email}</p>
        </div>
        <IconButton size="sm" onClick={onRemove} aria-label={`Quitar a ${candidate.name}`}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Rol</label>
          <div className="mt-1">
            <Combobox
              value={role}
              onChange={(v) => onChangeRole(v as StaffRole)}
              options={roleOptions}
              placeholder="Selecciona un rol"
              searchPlaceholder="Buscar rol…"
              emptyLabel="Sin roles que coincidan"
              ariaLabel={`Rol de ${candidate.name}`}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`pin-${candidate.staffId}`}>
            PIN (4-6 dígitos)
          </label>
          <input
            id={`pin-${candidate.staffId}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => onChangePin(e.target.value)}
            placeholder="Ej. 1234"
            aria-label={`PIN de ${candidate.name}`}
            className={cn(
              'tabular mt-1 h-10 w-full rounded-[6px] border border-[var(--line-strong)] bg-[var(--canvas)] px-3 font-mono text-[13px] text-[var(--ink)] outline-none transition-colors',
              'placeholder:font-sans placeholder:text-[var(--ink-faint)]',
              'hover:border-[var(--accent-line)] focus-visible:border-[var(--accent-line)]',
            )}
          />
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-snug text-[var(--ink-muted)]">{summary}</p>
    </li>
  )
}

/* ─── Sub-componentes ──────────────────────────────────────────── */

function EmptyRows({ hasCandidates, loading }: { hasCandidates: boolean; loading: boolean }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--line-strong)] bg-[var(--canvas-sunken)] px-4 py-6 text-center">
      <p className="text-[12.5px] text-[var(--ink-muted)]">
        {loading
          ? 'Cargando personas…'
          : hasCandidates
            ? 'Aún no agregaste a nadie. Usa el buscador de arriba para dar acceso a una persona.'
            : 'No hay personas en la organización a quienes dar acceso.'}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="eyebrow">{title}</h3>
      <div>{children}</div>
    </section>
  )
}
