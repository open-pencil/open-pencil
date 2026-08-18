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
import { SignJWT } from 'jose'
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
  const bytes = new Uint8Array(bits)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

async function signedTicket(
  authSecret: string,
  documentId: string,
  principal: CollaborationPrincipal,
  permission: DocumentPermission,
  roomEpoch: number,
  collaborationURL?: string
): Promise<CollaborationTicket> {
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
    serverEnforcedWrites: Boolean(collaborationURL)
  }
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAtSeconds)
    .setSubject(principal.kind === 'user' ? principal.userId : principal.guestId)
    .sign(new TextEncoder().encode(authSecret))
  return {
    token,
    provider: collaborationURL ? ('hocuspocus' as const) : ('trystero' as const),
    ...(collaborationURL ? { serverURL: collaborationURL } : {}),
    ...claims,
    roomKey,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  }
}

export function createCollaborationTicketService(
  database: Kysely<CloudDatabase>,
  sharing: DocumentSharingService,
  authSecret: string,
  collaborationURL?: string,
  policy?: CloudPolicy,
  deploymentMode: 'official' | 'self-hosted' = 'self-hosted'
) {
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
      return signedTicket(
        authSecret,
        documentId,
        { kind: 'user', userId: actor.userId, name: actor.name, email: actor.email },
        access.permission,
        document.collaborationEpoch,
        collaborationURL
      )
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
      return signedTicket(
        authSecret,
        resolved.documentId,
        resolved.principal,
        resolved.permission,
        document.collaborationEpoch,
        collaborationURL
      )
    }
  }
}

export type CollaborationTicketService = ReturnType<typeof createCollaborationTicketService>
