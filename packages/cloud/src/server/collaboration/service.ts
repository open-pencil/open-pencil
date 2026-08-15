import type {
  CollaborationPrincipal,
  CollaborationTicket,
  DocumentPermission,
  ResolveDocumentShareInput
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents'
import { resolveDocumentAccess } from '#cloud/server/documents/access'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { SignJWT } from 'jose'
import type { Kysely } from 'kysely'

const TICKET_LIFETIME_SECONDS = 5 * 60

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  )
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function signedTicket(
  authSecret: string,
  documentId: string,
  principal: CollaborationPrincipal,
  permission: DocumentPermission,
  roomEpoch: number
): Promise<CollaborationTicket> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAtSeconds = issuedAt + TICKET_LIFETIME_SECONDS
  const roomId = `cloud:${documentId}:${roomEpoch}`
  const roomKey = await sha256(`${authSecret}:room:${documentId}:${roomEpoch}`)
  const claims = {
    documentId,
    roomId,
    principal,
    permission,
    roomEpoch,
    serverEnforcedWrites: false as const
  }
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .setSubject(principal.kind === 'user' ? principal.userId : principal.guestId)
    .sign(new TextEncoder().encode(authSecret))
  return {
    token,
    ...claims,
    roomKey,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  }
}

export function createCollaborationTicketService(
  database: Kysely<CloudDatabase>,
  sharing: DocumentSharingService,
  authSecret: string
) {
  return {
    async issueUserTicket(actor: CloudActor, documentId: string): Promise<CollaborationTicket> {
      const access = await resolveDocumentAccess(database, actor.userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      return signedTicket(
        authSecret,
        documentId,
        { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email },
        access.permission,
        0
      )
    },

    async issueShareTicket(
      shareId: string,
      input: ResolveDocumentShareInput,
      actor?: CloudActor
    ): Promise<CollaborationTicket> {
      const resolved = await sharing.resolveShare(shareId, input, actor)
      return signedTicket(
        authSecret,
        resolved.documentId,
        resolved.principal,
        resolved.permission,
        resolved.roomEpoch
      )
    }
  }
}

export type CollaborationTicketService = ReturnType<typeof createCollaborationTicketService>
