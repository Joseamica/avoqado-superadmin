/* eslint-disable react-refresh/only-export-components --
 * Test utility: este archivo expone componentes (AllProviders, renderWithProviders)
 * Y re-exports de @testing-library/react. Las reglas de Fast Refresh no aplican
 * a archivos de test que jamás llegan al bundle de producción.
 */
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
import { AuthProvider } from '@/features/auth/AuthProvider'

interface ProvidersProps {
  children: ReactNode
  initialEntries?: string[]
}

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function AllProviders({ children, initialEntries = ['/'] }: ProvidersProps) {
  const queryClient = buildQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] } = {},
) {
  const { initialEntries, ...rest } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries}>{children}</AllProviders>
    ),
    ...rest,
  })
}

export * from '@testing-library/react'
