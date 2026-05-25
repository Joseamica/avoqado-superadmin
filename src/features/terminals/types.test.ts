import { describe, expect, it } from 'vitest'
import {
  canBeActivated,
  COMMAND_SEVERITY,
  humanizeCommand,
  humanizeTerminalStatus,
  humanizeTerminalType,
  isTerminalOnline,
  TERMINAL_STATUS_TONE,
  TERMINAL_TYPE_TONE,
  type TerminalStatus,
  type TerminalType,
  type TpvCommand,
} from './types'

/**
 * Tests para helpers y mapas del feature de Terminals.
 *
 * Misma filosofía que `venues/types.test.ts`: TypeScript ya nos cuida la
 * exhaustividad de los switches; estos tests fijan el contrato semántico
 * (cuál tono, qué texto, qué predicate) para que cualquier cambio sea
 * intencional y visible en el diff.
 */

describe('humanizeTerminalType', () => {
  it.each<[TerminalType, string]>([
    ['TPV_ANDROID', 'TPV Android'],
    ['TPV_IOS', 'TPV iOS'],
    ['PRINTER_RECEIPT', 'Impresora ticket'],
    ['PRINTER_KITCHEN', 'Impresora cocina'],
    ['KDS', 'KDS'],
  ])('%s → %s', (type, expected) => {
    expect(humanizeTerminalType(type)).toBe(expected)
  })
})

describe('humanizeTerminalStatus', () => {
  it.each<[TerminalStatus, string]>([
    ['PENDING_ACTIVATION', 'Sin activar'],
    ['ACTIVE', 'Activa'],
    ['INACTIVE', 'Inactiva'],
    ['MAINTENANCE', 'En mantenimiento'],
    ['RETIRED', 'Retirada'],
  ])('%s → %s', (status, expected) => {
    expect(humanizeTerminalStatus(status)).toBe(expected)
  })
})

describe('humanizeCommand', () => {
  it.each<[TpvCommand, string]>([
    ['RESTART', 'Reiniciar app'],
    ['SHUTDOWN', 'Apagar'],
    ['CLEAR_CACHE', 'Limpiar caché'],
    ['FACTORY_RESET', 'Restablecer de fábrica'],
    ['LOCK', 'Bloquear'],
    ['UNLOCK', 'Desbloquear'],
    ['MAINTENANCE_MODE', 'Entrar en mantenimiento'],
    ['EXIT_MAINTENANCE', 'Salir de mantenimiento'],
    ['REACTIVATE', 'Reactivar'],
    ['REMOTE_ACTIVATE', 'Activar remotamente'],
    ['INSTALL_VERSION', 'Instalar versión específica'],
    ['FORCE_UPDATE', 'Forzar actualización'],
    ['REQUEST_UPDATE', 'Pedir actualización'],
    ['SYNC_DATA', 'Sincronizar datos'],
    ['EXPORT_LOGS', 'Exportar logs'],
    ['UPDATE_CONFIG', 'Actualizar configuración'],
    ['REFRESH_MENU', 'Refrescar menú'],
    ['UPDATE_MERCHANT', 'Cambiar merchant activo'],
  ])('%s → %s', (cmd, expected) => {
    expect(humanizeCommand(cmd)).toBe(expected)
  })
})

describe('isTerminalOnline', () => {
  it('devuelve false cuando lastHeartbeat es null', () => {
    expect(isTerminalOnline({ lastHeartbeat: null })).toBe(false)
  })

  it('devuelve true si el heartbeat es de hace menos de 5 minutos', () => {
    const now = new Date()
    const oneMinAgo = new Date(now.getTime() - 60_000).toISOString()
    expect(isTerminalOnline({ lastHeartbeat: oneMinAgo })).toBe(true)
  })

  it('devuelve false si el heartbeat es de hace más de 5 minutos', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
    expect(isTerminalOnline({ lastHeartbeat: tenMinAgo })).toBe(false)
  })

  it('devuelve true para un heartbeat justo en el borde inferior (1ms atrás)', () => {
    const justNow = new Date(Date.now() - 1).toISOString()
    expect(isTerminalOnline({ lastHeartbeat: justNow })).toBe(true)
  })
})

describe('canBeActivated', () => {
  it('devuelve true sólo cuando status es PENDING_ACTIVATION y no tiene activatedAt', () => {
    expect(canBeActivated({ status: 'PENDING_ACTIVATION', activatedAt: null })).toBe(true)
  })

  it('devuelve false si ya fue activada antes', () => {
    expect(
      canBeActivated({
        status: 'PENDING_ACTIVATION',
        activatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(false)
  })

  it('devuelve false para cualquier otro status, aunque no tenga activatedAt', () => {
    expect(canBeActivated({ status: 'ACTIVE', activatedAt: null })).toBe(false)
    expect(canBeActivated({ status: 'INACTIVE', activatedAt: null })).toBe(false)
    expect(canBeActivated({ status: 'MAINTENANCE', activatedAt: null })).toBe(false)
    expect(canBeActivated({ status: 'RETIRED', activatedAt: null })).toBe(false)
  })
})

describe('TERMINAL_STATUS_TONE', () => {
  it('asigna success a ACTIVE y warn a estados que requieren atención', () => {
    expect(TERMINAL_STATUS_TONE.ACTIVE).toBe('success')
    expect(TERMINAL_STATUS_TONE.PENDING_ACTIVATION).toBe('warn')
    expect(TERMINAL_STATUS_TONE.MAINTENANCE).toBe('warn')
  })

  it('asigna muted a estados neutros (INACTIVE, RETIRED)', () => {
    expect(TERMINAL_STATUS_TONE.INACTIVE).toBe('muted')
    expect(TERMINAL_STATUS_TONE.RETIRED).toBe('muted')
  })
})

describe('TERMINAL_TYPE_TONE', () => {
  it('siempre es muted — el tipo es clasificación, no estado', () => {
    expect(TERMINAL_TYPE_TONE.TPV_ANDROID).toBe('muted')
    expect(TERMINAL_TYPE_TONE.TPV_IOS).toBe('muted')
    expect(TERMINAL_TYPE_TONE.PRINTER_RECEIPT).toBe('muted')
    expect(TERMINAL_TYPE_TONE.PRINTER_KITCHEN).toBe('muted')
    expect(TERMINAL_TYPE_TONE.KDS).toBe('muted')
  })
})

describe('COMMAND_SEVERITY', () => {
  it('marca SHUTDOWN y FACTORY_RESET como danger', () => {
    expect(COMMAND_SEVERITY.SHUTDOWN).toBe('danger')
    expect(COMMAND_SEVERITY.FACTORY_RESET).toBe('danger')
  })

  it('marca los disruptivos (LOCK, MAINTENANCE_MODE, FORCE_UPDATE) como warn', () => {
    expect(COMMAND_SEVERITY.LOCK).toBe('warn')
    expect(COMMAND_SEVERITY.MAINTENANCE_MODE).toBe('warn')
    expect(COMMAND_SEVERITY.FORCE_UPDATE).toBe('warn')
    expect(COMMAND_SEVERITY.INSTALL_VERSION).toBe('warn')
    expect(COMMAND_SEVERITY.UPDATE_MERCHANT).toBe('warn')
  })

  it('marca los rutinarios (RESTART, CLEAR_CACHE, etc.) como safe', () => {
    expect(COMMAND_SEVERITY.RESTART).toBe('safe')
    expect(COMMAND_SEVERITY.CLEAR_CACHE).toBe('safe')
    expect(COMMAND_SEVERITY.SYNC_DATA).toBe('safe')
    expect(COMMAND_SEVERITY.REFRESH_MENU).toBe('safe')
    expect(COMMAND_SEVERITY.UPDATE_CONFIG).toBe('safe')
    expect(COMMAND_SEVERITY.EXPORT_LOGS).toBe('safe')
    expect(COMMAND_SEVERITY.REQUEST_UPDATE).toBe('safe')
    expect(COMMAND_SEVERITY.UNLOCK).toBe('safe')
    expect(COMMAND_SEVERITY.EXIT_MAINTENANCE).toBe('safe')
    expect(COMMAND_SEVERITY.REACTIVATE).toBe('safe')
    expect(COMMAND_SEVERITY.REMOTE_ACTIVATE).toBe('safe')
  })
})
