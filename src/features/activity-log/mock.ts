/**
 * TODO(api): replace with `GET /api/v1/superadmin/activity-log` once we map the
 * real response shape. Keep this type compatible with the real endpoint.
 */

export type ActivityCategory = 'kyc' | 'venue' | 'terminal' | 'payment' | 'auth' | 'config'

export type ActivitySeverity = 'info' | 'success' | 'warn' | 'danger'

export interface ActivityEntry {
  id: string
  occurredAt: string // ISO 8601 UTC
  actor: { name: string; email: string; role: 'SUPERADMIN' | 'OPS' }
  category: ActivityCategory
  severity: ActivitySeverity
  action: string
  target: { label: string; href?: string } | null
  venue?: { name: string; timezone: string }
  source: { ip: string; device: string }
}

const nowMs = Date.now()
const ago = (ms: number) => new Date(nowMs - ms).toISOString()

export const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: 'act_01HZX7',
    occurredAt: ago(2 * 60_000),
    actor: { name: 'Mariana Salas', email: 'mariana@avoqado.io', role: 'SUPERADMIN' },
    category: 'kyc',
    severity: 'success',
    action: 'Aprobó KYC nivel 2',
    target: { label: 'La Tinieblas', href: '/venues/la-tinieblas' },
    venue: { name: 'La Tinieblas', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
  {
    id: 'act_01HZX6',
    occurredAt: ago(7 * 60_000),
    actor: { name: 'Diego Hernández', email: 'diego@avoqado.io', role: 'OPS' },
    category: 'terminal',
    severity: 'info',
    action: 'Programó update de firmware a 2.4.1',
    target: { label: '34 terminales PAX A910S' },
    source: { ip: '189.203.44.18', device: 'web' },
  },
  {
    id: 'act_01HZX5',
    occurredAt: ago(18 * 60_000),
    actor: { name: 'José Antonio Amieva', email: 'jose@avoqado.io', role: 'SUPERADMIN' },
    category: 'config',
    severity: 'warn',
    action: 'Modificó comisión transaccional · 1.95 % → 2.10 %',
    target: { label: 'SushiYa Polanco', href: '/venues/sushiya-polanco' },
    venue: { name: 'SushiYa Polanco', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
  {
    id: 'act_01HZX4',
    occurredAt: ago(34 * 60_000),
    actor: { name: 'Mariana Salas', email: 'mariana@avoqado.io', role: 'SUPERADMIN' },
    category: 'venue',
    severity: 'success',
    action: 'Onboarding completo · primer pago recibido',
    target: { label: 'Tacos del Centro', href: '/venues/tacos-del-centro' },
    venue: { name: 'Tacos del Centro', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.18', device: 'web' },
  },
  {
    id: 'act_01HZX3',
    occurredAt: ago(58 * 60_000),
    actor: { name: 'sistema · cron', email: 'system@avoqado.io', role: 'OPS' },
    category: 'payment',
    severity: 'danger',
    action: 'Conciliación de settlement falló · diferencia $1,283.40 MXN',
    target: { label: 'Reporte 2026-05-23' },
    source: { ip: '10.0.0.4', device: 'job' },
  },
  {
    id: 'act_01HZX2',
    occurredAt: ago(1.5 * 60 * 60_000),
    actor: { name: 'Diego Hernández', email: 'diego@avoqado.io', role: 'OPS' },
    category: 'kyc',
    severity: 'warn',
    action: 'Rechazó KYC · documento inválido',
    target: { label: 'Pulquería La Pirinola', href: '/venues/la-pirinola' },
    venue: { name: 'Pulquería La Pirinola', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.18', device: 'web' },
  },
  {
    id: 'act_01HZX1',
    occurredAt: ago(2.4 * 60 * 60_000),
    actor: { name: 'Mariana Salas', email: 'mariana@avoqado.io', role: 'SUPERADMIN' },
    category: 'auth',
    severity: 'info',
    action: 'Inició impersonación · venue staff',
    target: { label: 'Café Testarudo Roma Norte' },
    venue: { name: 'Café Testarudo Roma Norte', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
  {
    id: 'act_01HZX0',
    occurredAt: ago(3.1 * 60 * 60_000),
    actor: { name: 'José Antonio Amieva', email: 'jose@avoqado.io', role: 'SUPERADMIN' },
    category: 'config',
    severity: 'info',
    action: 'Habilitó módulo · Inventario',
    target: { label: 'SushiYa Polanco', href: '/venues/sushiya-polanco' },
    venue: { name: 'SushiYa Polanco', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
  {
    id: 'act_01HZWZ',
    occurredAt: ago(5.8 * 60 * 60_000),
    actor: { name: 'sistema · webhook', email: 'system@avoqado.io', role: 'OPS' },
    category: 'payment',
    severity: 'success',
    action: 'Stripe Connect · payout enviado · $48,720.00 MXN',
    target: { label: 'SushiYa Polanco' },
    source: { ip: '10.0.0.4', device: 'webhook' },
  },
  {
    id: 'act_01HZWY',
    occurredAt: ago(9 * 60 * 60_000),
    actor: { name: 'Diego Hernández', email: 'diego@avoqado.io', role: 'OPS' },
    category: 'terminal',
    severity: 'warn',
    action: 'Terminal sin reportar latido por 2h',
    target: { label: 'PAX A910S · serial T2401-993' },
    venue: { name: 'Don Toritos Condesa', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.18', device: 'web' },
  },
  {
    id: 'act_01HZWX',
    occurredAt: ago(14 * 60 * 60_000),
    actor: { name: 'Mariana Salas', email: 'mariana@avoqado.io', role: 'SUPERADMIN' },
    category: 'venue',
    severity: 'info',
    action: 'Creó cuenta de venue',
    target: { label: 'Mazapán Café Roma Sur', href: '/venues/mazapan-cafe' },
    venue: { name: 'Mazapán Café Roma Sur', timezone: 'America/Mexico_City' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
  {
    id: 'act_01HZWW',
    occurredAt: ago(22 * 60 * 60_000),
    actor: { name: 'José Antonio Amieva', email: 'jose@avoqado.io', role: 'SUPERADMIN' },
    category: 'config',
    severity: 'success',
    action: 'Agregó proveedor de pagos · Conekta',
    target: { label: 'Aggregator · MX-East' },
    source: { ip: '189.203.44.12', device: 'web' },
  },
]
