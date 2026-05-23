# Avoqado · Superadmin

Dashboard interno de operaciones para el equipo Avoqado. Apunta al backend principal (`avoqado-server`) bajo el namespace `/api/v1/superadmin/*`.

## Stack

- **Vite 7** + **React 18** + **TypeScript 5**
- **Tailwind v4** + **shadcn/ui** (estilo `new-york`, base color `neutral`)
- **TanStack Query** (server state) + **TanStack Table** (tablas)
- **react-hook-form** + **zod** (formularios y validación)
- **React Router v6** (rutas)
- **Firebase Auth** (mismo proyecto que `avoqado-web-dashboard`)
- **axios** con interceptor que inyecta el ID token de Firebase
- **luxon** para fechas con timezone (UTC → display)
- **sonner** (toasts), **recharts** (gráficas), **lucide-react** (iconos)

## Setup

```bash
cp .env.example .env
# completa las variables (Firebase + URL del backend)

npm install
npm run dev
```

La app corre en `http://localhost:5174`.

## Backend

Este dashboard consume `avoqado-server` bajo el namespace **existente** `/api/v1/superadmin/*`, ya protegido por `authenticateTokenMiddleware` + `authorizeRole([StaffRole.SUPERADMIN])`. **No** existe un servicio separado y **no** se crea un namespace v2 paralelo.

### Política de evolución (cómo NO romper al `avoqado-web-dashboard` que también consume estos endpoints)

1. **Aditivo siempre.** Cambios permitidos:
   - Agregar campos opcionales a un response.
   - Agregar endpoints nuevos.
   - Agregar query params opcionales.

   Cambios **prohibidos** (rompen al dashboard viejo):
   - Quitar o renombrar campos.
   - Cambiar tipos de campos existentes.
   - Cambiar la semántica de un campo.

2. **Sub-versión por endpoint cuando el shape genuinamente cambia.** Sólo ese endpoint adquiere un sufijo `/v2` (ej. `GET /superadmin/venues/v2`). El viejo sigue funcionando hasta que el dashboard viejo migre.

3. **Contract tests opcionales** en `avoqado-server` para pinear el shape vía snapshot — falla CI si alguien rompe sin querer.

## Timezone

- **Backend transmite UTC** (ISO 8601 con sufijo `Z`).
- **Display default**: `America/Mexico_City`.
- **Cuando la respuesta incluye `venue.timezone`**: se pasa explícitamente al helper para mostrar en hora del venue.
- Todas las funciones de fecha viven en [`src/lib/datetime.ts`](src/lib/datetime.ts):
  - `formatDateTime(iso, tz?)`, `formatDate`, `formatTime`, `formatDateISO`, `formatRelative`, `timezoneShort`
- En headers de tabla siempre se debe indicar el TZ visible (`Created at (CST)`).

Nada se infiere del browser. La decisión es explícita en cada uso.

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Vite dev server en :5174 |
| `npm run build` | Build de producción (`tsc -b && vite build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript en modo solo-verificación |
| `npm run preview` | Sirve el build de producción localmente |

## Estructura

```
src/
├── components/
│   ├── layouts/        # AppLayout con sidebar
│   └── ui/             # shadcn primitives (vacío — agregar con `npx shadcn add ...`)
├── context/            # AuthContext
├── hooks/              # custom hooks
├── lib/                # api.ts, firebase.ts, utils.ts, datetime.ts
├── pages/              # rutas top-level
├── router/             # AppRoutes + ProtectedRoute
└── types/              # tipos compartidos
```

## Agregar componentes shadcn/ui

```bash
npx shadcn@latest add button input label card dialog dropdown-menu
```
