import { createContext, useContext } from 'react'

/**
 * Context + hook del ⌘K palette. Separados del componente (que vive en
 * `./CommandPalette.tsx`) para que React Fast Refresh haga HMR sin romper
 * la referencia del contexto.
 */

export interface CommandPaletteContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>')
  return ctx
}
