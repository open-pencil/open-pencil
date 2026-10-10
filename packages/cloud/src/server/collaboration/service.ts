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
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { DocumentSharingService } from '#cloud/server/sharing'
import { base64url, SignJWT } from 'jose'
import type { Kysely } from 'kysely'

const TICKET_LIFETIME_SECONDS = 5 * 60

async function derivedRoomKey(authSecret: string, documentId: string, roomEpoch: number) {
  const inputBytes = new TextEncoder().encode(`${authSecret}:room:${documentId}:${roomEpoch}`)
  const key = await crypto.subtle.importKey('raw', inputBytes, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(`openpencil-cloud:${documentId}`),
      info: new TextEncoder().encode(`collaboration-room:${roomEpoch}`)
    },
    key,
    256
  )
  return base64url.encode(new Uint8Array(bits))
}

export type CollaborationTicketClaims = {
  authSecret: string
  documentId: string
  principal: CollaborationPrincipal
  permission: DocumentPermission
  roomEpoch: number
  /** The relay that enforces writes; without one the ticket is for peer-to-peer rooms. */
  relayURL?: string
}

/** Signs a ticket for a document's collaboration room once access has been decided. */
export async function signCollaborationTicket({
  authSecret,
  documentId,
  principal,
  permission,
  roomEpoch,
  relayURL
}: CollaborationTicketClaims): Promise<CollaborationTicket> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAtSeconds = issuedAt + TICKET_LIFETIME_SECONDS
  const roomId = `cloud:${documentId}:${roomEpoch}`
  const roomKey = await derivedRoomKey(authSecret, documentId, roomEpoch)
  const claims = {
    documentId,
    roomId,
    principal,
    permission,
    roomEpoch,
    serverEnforcedWrites: Boolean(relayURL)
  }
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .setSubject(principal.kind === 'user' ? principal.userId : principal.guestId)
    .sign(new TextEncoder().encode(authSecret))
  return {
    token,
    provider: relayURL ? ('relay' as const) : ('trystero' as const),
    ...(relayURL ? { serverURL: relayURL } : {}),
    ...claims,
    roomKey,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  }
}

export type CollaborationTicketServiceOptions = {
  database: Kysely<CloudDatabase>
  sharing: DocumentSharingService
  authSecret: string
  relayURL?: string
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export function createCollaborationTicketService({
  database,
  sharing,
  authSecret,
  relayURL,
  policy,
  deploymentMode = 'self-hosted'
}: CollaborationTicketServiceOptions) {
  return {
    async issueUserTicket(actor: CloudActor, documentId: string): Promise<CollaborationTicket> {
      const access = await resolveDocumentAccess(database, actor.userId, documentId)
      if (!access) throw new DocumentNotFoundError()
      if (policy) {
        const workspace = await database
          .selectFrom('document')
          .select('workspaceId')
          .where('id', '=', documentId)
          .executeTakeFirstOrThrow()
        if (
          !(await policy.boolean(CLOUD_FEATURE_KEYS.collaboration, false, {
            targetingKey: workspace.workspaceId,
            actorId: actor.userId,
            workspaceId: workspace.workspaceId,
            documentId,
            deploymentMode
          }))
        ) {
          throw new DocumentNotFoundError()
        }
      }
      const document = await database
        .selectFrom('document')
        .select('collaborationEpoch')
        .where('id', '=', documentId)
        .where('deletedAt', 'is', null)
        .executeTakeFirst()
      if (!document) throw new DocumentNotFoundError()
      return signCollaborationTicket({
        authSecret,
        documentId,
        principal: { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email },
        permission: access.permission,
        roomEpoch: document.collaborationEpoch,
        relayURL
      })
    },

    async issueShareTicket(
      shareId: string,
      input: ResolveDocumentShareInput,
      actor?: CloudActor
    ): Promise<CollaborationTicket> {
      const resolved = await sharing.resolveShare(shareId, input, actor)
      if (policy) {
        const workspace = await database
          .selectFrom('document')
          .select('workspaceId')
          .where('id', '=', resolved.documentId)
          .executeTakeFirstOrThrow()
        const context = {
          targetingKey: workspace.workspaceId,
          ...(actor ? { actorId: actor.userId } : {}),
          workspaceId: workspace.workspaceId,
          documentId: resolved.documentId,
          deploymentMode
        }
        if (!(await policy.boolean(CLOUD_FEATURE_KEYS.collaboration, false, context))) {
          throw new DocumentNotFoundError()
        }
        if (!actor && !(await policy.boolean(CLOUD_FEATURE_KEYS.guestPresence, false, context))) {
          throw new DocumentNotFoundError()
        }
      }
      const document = await database
        .selectFrom('document')
        .select('collaborationEpoch')
        .where('id', '=', resolved.documentId)
        .where('deletedAt', 'is', null)
        .executeTakeFirst()
      if (!document) throw new DocumentNotFoundError()
      return signCollaborationTicket({
        authSecret,
        documentId: resolved.documentId,
        principal: resolved.principal,
        permission: resolved.permission,
        roomEpoch: document.collaborationEpoch,
        relayURL
      })
    }
  }
}

export type CollaborationTicketService = ReturnType<typeof createCollaborationTicketService>
