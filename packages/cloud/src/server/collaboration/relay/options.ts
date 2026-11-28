import type { CollaborationStateStore } from './persistence'

/**
 * What a relay failure names: the room's document, and the user whose message met it. A peer
 * that failed to be admitted names only the document a single-document relay serves.
 */
export type RelayErrorIds = { documentId?: string; userId?: string }

export type CollaborationRelayOptions = {
  authSecret: string
  store: CollaborationStateStore
  /**
   * The one document this relay serves, for runtimes that run a relay per document; tickets for
   * any other document are refused.
   */
  documentId?: string
  /**
   * The most one socket message may carry. An editor's larger frames arrive as fragments joined
   * up to `maximumRoomBytes`; anyone else's frame must fit in one message.
   */
  maximumMessageBytes: number
  /**
   * The most a room's document may hold, and so the most one editor's update may carry:
   * `MAX_COLLAB_MESSAGE_BYTES` unless the runtime holds rooms in less memory.
   */
  maximumRoomBytes?: number
  maximumConnectionsPerRoom: number
  /** The participant limit policy sets for a document, or null for none. */
  maximumParticipants?: (documentId: string) => Promise<number | null>
  /**
   * The document's current collaboration epoch, which a restore advances; a ticket for an earlier
   * room is turned away so nobody rejoins the document as it was.
   */
  currentRoomEpoch?: (documentId: string) => Promise<number | null>
  /** How long after a change the room's document is saved. */
  persistDelayMs?: number
  /**
   * How many logged updates, or how many of their bytes, a room saves before it writes a fresh
   * snapshot in their place; a closing room always does.
   */
  compactAfterUpdates?: number
  compactAfterBytes?: number
  /** How long a room whose last save failed waits before saving again. */
  persistRetryMs?: number
  /** How long a socket may stay open without presenting a ticket. */
  authTimeoutMs?: number
  /** How long a design tool an app runs through an editor may take (`agent-tools.ts`). */
  agentToolTimeoutMs?: number
  /** Told of each failure, with the document and, when one asked, the signed-in user. */
  onError?: (message: string, error: unknown, ids?: RelayErrorIds) => void
}
