import type { CollaborationTicket } from '@open-pencil/cloud/contract'

export const COLLABORATION_TICKET_REFRESH_MARGIN_MS = 30_000

export function collaborationTicketExpiresAt(ticket: CollaborationTicket): number {
  const expiresAt = Date.parse(ticket.expiresAt)
  if (!Number.isFinite(expiresAt))
    throw new Error('Cloud collaboration ticket has an invalid expiry')
  return expiresAt
}

export function requireActiveCollaborationTicket(
  ticket: CollaborationTicket,
  now = Date.now()
): CollaborationTicket {
  if (collaborationTicketExpiresAt(ticket) <= now) {
    throw new Error('Cloud collaboration ticket has expired')
  }
  return ticket
}

export function collaborationTicketRefreshDelay(
  ticket: CollaborationTicket,
  now = Date.now()
): number {
  return Math.max(
    0,
    collaborationTicketExpiresAt(ticket) - now - COLLABORATION_TICKET_REFRESH_MARGIN_MS
  )
}

export function sameCollaborationRoom(
  current: CollaborationTicket,
  refreshed: CollaborationTicket
): boolean {
  return (
    current.documentId === refreshed.documentId &&
    current.roomId === refreshed.roomId &&
    current.roomKey === refreshed.roomKey &&
    current.roomEpoch === refreshed.roomEpoch &&
    current.permission === refreshed.permission &&
    JSON.stringify(current.principal) === JSON.stringify(refreshed.principal)
  )
}
