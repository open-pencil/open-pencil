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

export const collaborationTicketSchema = v.object({
  token: v.string(),
  documentId: v.pipe(v.string(), v.uuid()),
  roomId: v.string(),
  roomKey: v.string(),
  principal: collaborationPrincipalSchema,
  permission: documentPermissionSchema,
  roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expiresAt: v.string(),
  serverEnforcedWrites: v.literal(false)
})
export type CollaborationTicket = v.InferOutput<typeof collaborationTicketSchema>
