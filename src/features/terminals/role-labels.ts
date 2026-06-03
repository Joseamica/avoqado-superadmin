/**
 * Labels en español de los roles de staff + la lista de roles que el operador
 * puede asignar desde el picker de acceso.
 *
 * `ROLE_LABEL_ES` cubre TODOS los roles del backend (incluidos OWNER y
 * SUPERADMIN) para poder mostrar legible el rol que una persona ya tiene.
 * `ASSIGNABLE_ROLES` es deliberadamente más corto: OWNER y SUPERADMIN nunca se
 * ofrecen como opción asignable — son roles que no se otorgan desde esta
 * herramienta.
 */

import type { StaffRole } from './api'

export const ROLE_LABEL_ES: Record<StaffRole, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  CASHIER: 'Cajero',
  WAITER: 'Mesero',
  KITCHEN: 'Cocina',
  HOST: 'Anfitrión',
  VIEWER: 'Solo ver',
  SUPERADMIN: 'Superadmin',
}

/**
 * Roles que el picker ofrece como asignables. Excluye OWNER y SUPERADMIN a
 * propósito (no se otorgan desde aquí). Si una persona ya tiene un rol fuera de
 * esta lista, el componente lo agrega como opción extra para no perderlo.
 */
export const ASSIGNABLE_ROLES: StaffRole[] = [
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'HOST',
  'VIEWER',
]
