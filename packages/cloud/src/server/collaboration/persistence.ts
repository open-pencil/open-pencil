import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'
import * as Y from 'yjs'

const ROOM_PATTERN = /^cloud:([0-9a-f-]{36}):(\d+)$/i

export type CollaborationRoomIdentity = {
  documentId: string
  roomEpoch: number
}

export function collaborationRoomIdentity(roomId: string): CollaborationRoomIdentity {
  const match = ROOM_PATTERN.exec(roomId)
  if (!match?.[1] || !match[2]) throw new Error('Invalid Cloud collaboration room')
  return { documentId: match[1], roomEpoch: Number(match[2]) }
}

export function createCollaborationStateStore(database: Kysely<CloudDatabase>) {
  return {
    async load(roomId: string): Promise<Uint8Array | null> {
      const room = collaborationRoomIdentity(roomId)
      const row = await database
        .selectFrom('documentCollaborationState')
        .select('state')
        .where('documentId', '=', room.documentId)
        .where('roomEpoch', '=', room.roomEpoch)
        .executeTakeFirst()
      return row ? new Uint8Array(row.state) : null
    },

    async storeState(roomId: string, state: Uint8Array): Promise<void> {
      const room = collaborationRoomIdentity(roomId)
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
    },

    async store(roomId: string, document: Y.Doc): Promise<void> {
      await this.storeState(roomId, Y.encodeStateAsUpdate(document))
    }
  }
}

export type CollaborationStateStore = ReturnType<typeof createCollaborationStateStore>
