# Avoqado · Superadmin

Dashboard interno de operaciones para el equipo Avoqado. Apunta al backend principal (`avoqado-server`) bajo el namespace `/api/v1/admin/*`.

## Stack

- **Vite 7** + **React 18** + **TypeScript 5**
- **Tailwind v4** + **shadcn/ui** (estilo `new-york`, base color `neutral`)
- **TanStack Query** (server state) + **TanStack Table** (tablas)
- **react-hook-form** + **zod** (formularios y validación)
- **React Router v6** (rutas)
- **Firebase Auth** (mismo proyecto que `avoqado-web-dashboard`)
- **axios** con interceptor que inyecta el ID token de Firebase
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

**No** existe un servicio separado para superadmin. Las rutas viven en `avoqado-server` bajo `/api/v1/admin/*`, protegidas por middleware de rol `SUPERADMIN`. Razones:

- Un único Prisma schema (206 modelos) — no se duplica.
- Las reglas de permissions ya están centralizadas en el server.
- Evitamos el anti-patrón de dos servicios escribiendo la misma BD.

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
├── lib/                # api.ts, firebase.ts, utils.ts
├── pages/              # rutas top-level
├── router/             # AppRoutes + ProtectedRoute
└── types/              # tipos compartidos
```

## Agregar componentes shadcn/ui

```bash
npx shadcn@latest add button input label card dialog dropdown-menu
```
