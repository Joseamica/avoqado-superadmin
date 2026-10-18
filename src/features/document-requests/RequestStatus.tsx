import { Badge } from '@/shared/ui/Badge'
import type { DocumentRequest } from './api'

export function RequestStatus({ request }: { request: DocumentRequest }) {
  if (request.status === 'REVOKED') return <Badge tone="danger">Revocada</Badge>
  if (request.status === 'SUBMITTED') return <Badge tone="success">Recibida</Badge>
  if (Date.parse(request.expiresAt) <= Date.now()) return <Badge tone="warn">Vencida</Badge>
  return <Badge tone="warn">Esperando documentos</Badge>
}
