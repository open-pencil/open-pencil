import {
  collaborationPrincipalSchema,
  type CollaborationPrincipal,
  type DocumentPermission
} from '#cloud/contract'
import { jwtVerify } from 'jose'
import * as v from 'valibot'

const relayClaimsSchema = v.object({
  documentId: v.pipe(v.string(), v.uuid()),
  roomId: v.string(),
  principal: collaborationPrincipalSchema,
  permission: v.picklist(['view', 'edit']),
  roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0)),
  serverEnforcedWrites: v.literal(true),
  exp: v.pipe(v.number(), v.integer())
})

export type RelayAuthorization = {
  roomId: string
  documentId: string
  roomEpoch: number
  permission: DocumentPermission
  principal: CollaborationPrincipal
  /** When the ticket stops being valid, in milliseconds since the epoch. */
  expiresAt: number
}

/** Verifies a collaboration ticket issued for the relay; throws for anything else. */
export async function authorizeRelayTicket(
  token: string,
  authSecret: string
): Promise<RelayAuthorization> {
  const verified = await jwtVerify(token, new TextEncoder().encode(authSecret), {
    algorithms: ['HS256']
  })
  const claims = v.parse(relayClaimsSchema, verified.payload)
  if (claims.roomId !== `cloud:${claims.documentId}:${claims.roomEpoch}`) {
    throw new Error('Collaboration ticket names a different room')
  }
  return {
    roomId: claims.roomId,
    documentId: claims.documentId,
    roomEpoch: claims.roomEpoch,
    permission: claims.permission,
    principal: claims.principal,
    expiresAt: claims.exp * 1000
  }
}

export function principalKey(principal: CollaborationPrincipal): string {
  return principal.kind === 'user' ? `user:${principal.userId}` : `guest:${principal.guestId}`
}
