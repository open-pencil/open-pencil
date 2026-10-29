import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export type CollaborationRoomIdentity = {
  documentId: string
  roomEpoch: number
}

/** The relay's saved copy of each room's document, by document and collaboration epoch. */
export type CollaborationStateStore = {
  load(room: CollaborationRoomIdentity): Promise<Uint8Array | null>
  store(room: CollaborationRoomIdentity, state: Uint8Array): Promise<void>
}

export function createCollaborationStateStore(
  database: Kysely<CloudDatabase>
): CollaborationStateStore {
  return {
    async load(room) {
      const row = await database
        .selectFrom('documentCollaborationState')
        .select('state')
        .where('documentId', '=', room.documentId)
        .where('roomEpoch', '=', room.roomEpoch)
        .executeTakeFirst()
      return row ? new Uint8Array(row.state) : null
    },

    async store(room, state) {
      await database
        .insertInto('documentCollaborationState')
        .values({
          documentId: room.documentId,
          roomEpoch: room.roomEpoch,
          state,
          updatedAt: new Date()
        })
        .onConflict((conflict) =>
          conflict.columns(['documentId', 'roomEpoch']).doUpdateSet({
            state,
            version: (expression) => expression('documentCollaborationState.version', '+', 1),
            updatedAt: new Date()
          })
        )
        .execute()
    }
  }
}
