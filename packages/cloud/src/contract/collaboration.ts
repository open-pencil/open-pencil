import * as v from 'valibot'

import { documentPermissionSchema } from './documents'

export const collaborationPrincipalSchema = v.variant('kind', [
  v.object({
    kind: v.literal('user'),
    userId: v.string(),
    name: v.string(),
    email: v.pipe(v.string(), v.email())
  }),
  v.object({
    kind: v.literal('guest'),
    guestId: v.string(),
    name: v.string()
  })
])
export type CollaborationPrincipal = v.InferOutput<typeof collaborationPrincipalSchema>

/**
 * Who the relay verified a peer to be, as it writes into that peer's presence under `cloud`, so
 * other peers can trust it over what the peer says of itself.
 */
export const cloudPresenceSchema = v.object({
  kind: v.picklist(['user', 'guest']),
  id: v.string(),
  name: v.string(),
  permission: documentPermissionSchema
})
export type CloudPresence = v.InferOutput<typeof cloudPresenceSchema>

export const collaborationTicketSchema = v.object({
  token: v.string(),
  provider: v.optional(v.picklist(['trystero', 'relay'])),
  serverURL: v.optional(v.pipe(v.string(), v.url())),
  documentId: v.pipe(v.string(), v.uuid()),
  roomId: v.string(),
  roomKey: v.pipe(v.string(), v.minLength(43), v.maxLength(128)),
  principal: collaborationPrincipalSchema,
  permission: documentPermissionSchema,
  roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expiresAt: v.string(),
  serverEnforcedWrites: v.boolean()
})
export type CollaborationTicket = v.InferOutput<typeof collaborationTicketSchema>
