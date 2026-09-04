import {
  collaborationPrincipalSchema,
  type CollaborationPrincipal,
  type CollaborationTicket,
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
  serverEnforcedWrites: v.boolean()
})

export type CollaborationRelayAuthorization = {
  roomId: string
  documentId: string
  permission: DocumentPermission
  principal: CollaborationPrincipal
  roomEpoch: number
  readOnly: boolean
}

export async function authorizeCollaborationRelay(
  token: string,
  documentName: string,
  authSecret: string
): Promise<CollaborationRelayAuthorization> {
  const verified = await jwtVerify(token, new TextEncoder().encode(authSecret), {
    algorithms: ['HS256']
  })
  const claims = v.parse(relayClaimsSchema, verified.payload)
  if (claims.roomId !== documentName || !claims.serverEnforcedWrites) {
    throw new Error('Collaboration ticket is not valid for this room')
  }
  return {
    roomId: claims.roomId,
    documentId: claims.documentId,
    permission: claims.permission,
    principal: claims.principal,
    roomEpoch: claims.roomEpoch,
    readOnly: claims.permission === 'view'
  }
}

export function collaborationProviderOptions(ticket: CollaborationTicket) {
  if (ticket.provider !== 'hocuspocus' || !ticket.serverURL) return null
  return {
    url: ticket.serverURL,
    name: ticket.roomId,
    token: ticket.token
  }
}
