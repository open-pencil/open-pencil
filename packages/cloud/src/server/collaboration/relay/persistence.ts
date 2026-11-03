import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

export type CollaborationRoomIdentity = {
  documentId: string
  roomEpoch: number
}

/** A room as the store keeps it: its last snapshot and the updates logged after it. */
export type SavedRoom = {
  snapshot: Uint8Array | null
  /** The updates after the snapshot, in the order they were logged. */
  updates: Uint8Array[]
  /** The sequence of the last update the snapshot or the log holds; 0 for a new room. */
  sequence: number
}

/**
 * The relay's saved copy of each room's document, by document and collaboration epoch: a snapshot
 * and an append-only log of the updates after it. Each room has one writer, the relay that holds
 * it, so sequences only grow.
 */
export type CollaborationStateStore = {
  load(room: CollaborationRoomIdentity): Promise<SavedRoom>
  /**
   * Logs one update; fails when the sequence is already taken. Writes nothing once a restore moved
   * the document past the room's epoch, since that room never opens again.
   */
  append(room: CollaborationRoomIdentity, sequence: number, update: Uint8Array): Promise<void>
  /**
   * Replaces the snapshot with `state`, which holds every update through `sequence`, and drops
   * those updates; running it again leaves the same room. Like `append`, it writes nothing for an
   * epoch a restore replaced.
   */
  compact(room: CollaborationRoomIdentity, sequence: number, state: Uint8Array): Promise<void>
}

/**
 * Whether the document is still at the room's epoch, holding its row so a restore, which advances
 * the epoch and deletes the replaced rooms' rows, waits for this write or this write sees it.
 */
async function holdsEpoch(
  transaction: Transaction<CloudDatabase>,
  room: CollaborationRoomIdentity
): Promise<boolean> {
  const document = await transaction
    .selectFrom('document')
    .select('collaborationEpoch')
    .where('id', '=', room.documentId)
    .forShare()
    .executeTakeFirst()
  return document?.collaborationEpoch === room.roomEpoch
}

export function createCollaborationStateStore(
  database: Kysely<CloudDatabase>
): CollaborationStateStore {
  return {
    async load(room) {
      const snapshot = await database
        .selectFrom('documentCollaborationState')
        .select(['state', 'throughSequence'])
        .where('documentId', '=', room.documentId)
        .where('roomEpoch', '=', room.roomEpoch)
        .executeTakeFirst()
      const through = snapshot?.throughSequence ?? 0
      const updates = await database
        .selectFrom('documentCollaborationUpdate')
        .select(['sequence', 'data'])
        .where('documentId', '=', room.documentId)
        .where('roomEpoch', '=', room.roomEpoch)
        .where('sequence', '>', through)
        .orderBy('sequence')
        .execute()
      return {
        snapshot: snapshot ? new Uint8Array(snapshot.state) : null,
        updates: updates.map((row) => new Uint8Array(row.data)),
        sequence: updates.at(-1)?.sequence ?? through
      }
    },

    async append(room, sequence, update) {
      await database.transaction().execute(async (transaction) => {
        if (!(await holdsEpoch(transaction, room))) return
        await transaction
          .insertInto('documentCollaborationUpdate')
          .values({
            documentId: room.documentId,
            roomEpoch: room.roomEpoch,
            sequence,
            data: update
          })
          .execute()
      })
    },

    async compact(room, sequence, state) {
      await database.transaction().execute(async (transaction) => {
        if (!(await holdsEpoch(transaction, room))) return
        await transaction
          .insertInto('documentCollaborationState')
          .values({
            documentId: room.documentId,
            roomEpoch: room.roomEpoch,
            state,
            throughSequence: sequence,
            updatedAt: new Date()
          })
          .onConflict((conflict) =>
            conflict.columns(['documentId', 'roomEpoch']).doUpdateSet({
              state,
              throughSequence: sequence,
              version: (expression) => expression('documentCollaborationState.version', '+', 1),
              updatedAt: new Date()
            })
          )
          .execute()
        await transaction
          .deleteFrom('documentCollaborationUpdate')
          .where('documentId', '=', room.documentId)
          .where('roomEpoch', '=', room.roomEpoch)
          .where('sequence', '<=', sequence)
          .execute()
      })
    }
  }
}
