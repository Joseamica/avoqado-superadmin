import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { TooltipProvider } from '@/shared/ui/Tooltip'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/*
          `delayDuration={150}` — default de Radix es 700ms, demasiado
          lento para un operador que scanea iconos de la tabla. 150ms se
          siente instantáneo sin disparar tooltips en flybys accidentales.
          `skipDelayDuration={300}` — una vez que un tooltip aparece, el
          siguiente que pase el cursor por encima dentro de 300ms aparece
          sin delay (útil al recorrer 5 iconos consecutivos).
        */}
        <TooltipProvider delayDuration={150} skipDelayDuration={300}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
        <Toaster richColors position="top-right" />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
