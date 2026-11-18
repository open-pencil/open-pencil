import { collaborationPrincipalSchema } from '#cloud/contract'
import * as v from 'valibot'

const peerStateSchema = v.object({
  peerId: v.pipe(v.string(), v.uuid()),
  authorization: v.object({
    roomId: v.string(),
    documentId: v.pipe(v.string(), v.uuid()),
    roomEpoch: v.pipe(v.number(), v.integer(), v.minValue(0)),
    permission: v.picklist(['view', 'edit']),
    principal: collaborationPrincipalSchema,
    expiresAt: v.number()
  }),
  presenceClients: v.array(v.pipe(v.number(), v.integer()))
})

/**
 * What a runtime keeps with each admitted socket so the relay can resume its peer after the
 * runtime set the relay aside, as a hibernating Durable Object does: who it is, what its ticket
 * allows, and the presence clients it speaks for.
 */
export type RelayPeerState = v.InferOutput<typeof peerStateSchema>

/** A peer's kept state, or null when what the runtime kept is not one. */
export function readRelayPeerState(value: unknown): RelayPeerState | null {
  const parsed = v.safeParse(peerStateSchema, value)
  return parsed.success ? parsed.output : null
}
