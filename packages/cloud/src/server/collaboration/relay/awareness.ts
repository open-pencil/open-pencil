import type { CollaborationPrincipal, DocumentPermission } from '#cloud/contract'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as v from 'valibot'

const AwarenessStateJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.looseObject({ user: v.optional(v.looseObject({})) })
)

type AwarenessEntry = { clientId: number; clock: number; state: string }

function decodeEntries(update: Uint8Array): AwarenessEntry[] | null {
  try {
    const decoder = decoding.createDecoder(update)
    const count = decoding.readVarUint(decoder)
    const entries: AwarenessEntry[] = []
    for (let index = 0; index < count; index++) {
      entries.push({
        clientId: decoding.readVarUint(decoder),
        clock: decoding.readVarUint(decoder),
        state: decoding.readVarString(decoder)
      })
    }
    return decoder.pos === update.byteLength ? entries : null
  } catch {
    return null
  }
}

function encodeEntries(entries: AwarenessEntry[]): Uint8Array {
  return encoding.encode((encoder) => {
    encoding.writeVarUint(encoder, entries.length)
    for (const entry of entries) {
      encoding.writeVarUint(encoder, entry.clientId)
      encoding.writeVarUint(encoder, entry.clock)
      encoding.writeVarString(encoder, entry.state)
    }
  })
}

/** Who the relay verified a peer to be, as other peers see it in presence. */
export type VerifiedPresence = {
  principal: CollaborationPrincipal
  permission: DocumentPermission
}

function verifiedIdentity({ principal, permission }: VerifiedPresence) {
  return {
    kind: principal.kind,
    id: principal.kind === 'user' ? principal.userId : principal.guestId,
    name: principal.name,
    permission
  }
}

export type StampedAwareness = {
  /** The update to forward, or null when nothing in it may be forwarded. */
  update: Uint8Array | null
  /** Presence clients this update introduced for the peer. */
  claimed: number[]
}

/**
 * Rewrites a peer's presence update so others see who the relay verified rather than what the
 * peer claims: the display name comes from the ticket, and a `cloud` field carries the verified
 * identity and permission. Entries for presence clients another peer owns are dropped, so one
 * peer cannot speak for another; removals pass through for the peer's own clients only.
 */
export function stampAwareness(
  update: Uint8Array,
  presence: VerifiedPresence,
  ownedByOthers: (clientId: number) => boolean
): StampedAwareness {
  const entries = decodeEntries(update)
  if (!entries) return { update: null, claimed: [] }
  const identity = verifiedIdentity(presence)
  const forwarded: AwarenessEntry[] = []
  const claimed: number[] = []
  for (const entry of entries) {
    if (ownedByOthers(entry.clientId)) continue
    if (entry.state === 'null') {
      forwarded.push(entry)
      continue
    }
    const parsed = v.safeParse(AwarenessStateJSON, entry.state)
    if (!parsed.success) continue
    const state = {
      ...parsed.output,
      user: { ...parsed.output.user, name: identity.name },
      cloud: identity
    }
    claimed.push(entry.clientId)
    forwarded.push({ ...entry, state: JSON.stringify(state) })
  }
  return { update: forwarded.length > 0 ? encodeEntries(forwarded) : null, claimed }
}
