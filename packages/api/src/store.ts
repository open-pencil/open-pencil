import type { CreateInvitationInput, InvitationRecord, InvitationStore } from './types.js'

function cloneInvitation(record: InvitationRecord): InvitationRecord {
  return structuredClone(record)
}

export function createInvitationStore(): InvitationStore {
  const invitations = new Map<string, InvitationRecord>()

  return {
    createInvitation(input) {
      const record: InvitationRecord = {
        id: crypto.randomUUID(),
        boardId: input.boardId,
        sentToEmailHash: input.sentToEmailHash,
        role: input.role,
        createdAt: Date.now(),
        expiresAt: input.expiresAt,
        revoked: false,
        jti: crypto.randomUUID(),
        token: null
      }
      invitations.set(record.id, record)
      return cloneInvitation(record)
    },
    findInvitation(id) {
      const record = invitations.get(id)
      return record ? cloneInvitation(record) : null
    },
    listInvitationsByBoardId(boardId) {
      return [...invitations.values()]
        .filter((record) => record.boardId === boardId)
        .map((record) => cloneInvitation(record))
    },
    attachInvitationToken(id, token) {
      const record = invitations.get(id)
      if (!record) return null
      record.token = token
      invitations.set(id, record)
      return cloneInvitation(record)
    },
    revokeInvitation(id) {
      const record = invitations.get(id)
      if (!record) return null
      record.revoked = true
      invitations.set(id, record)
      return cloneInvitation(record)
    }
  }
}
