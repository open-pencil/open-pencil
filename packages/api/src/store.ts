import { asc, eq } from 'drizzle-orm'

import type { ApiDatabase } from './db/client.js'
import { createMigratedApiDatabase } from './db/migrate.js'
import { invitations } from './db/schema.js'
import type { CreateInvitationInput, InvitationRecord, InvitationStore } from './types.js'

export interface CreateInvitationStoreOptions {
  database?: ApiDatabase
  now?: () => number
}

function cloneInvitation(record: InvitationRecord): InvitationRecord {
  return structuredClone(record)
}

function mapInvitation(row: typeof invitations.$inferSelect): InvitationRecord {
  return {
    id: row.id,
    boardId: row.boardId,
    sentToEmailHash: row.sentToEmailHash,
    role: row.role,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revoked: row.revoked,
    jti: row.jti,
    token: row.token
  }
}

async function createInMemoryDatabase() {
  return await createMigratedApiDatabase({ mode: 'memory' })
}

export async function createInvitationStore(
  options: CreateInvitationStoreOptions = {}
): Promise<InvitationStore> {
  const database = options.database ?? (await createInMemoryDatabase())
  const now = options.now ?? Date.now

  const store: InvitationStore = {
    async createInvitation(input: CreateInvitationInput) {
      const record: InvitationRecord = {
        id: crypto.randomUUID(),
        boardId: input.boardId,
        sentToEmailHash: input.sentToEmailHash,
        role: input.role,
        createdAt: now(),
        expiresAt: input.expiresAt,
        revoked: false,
        jti: crypto.randomUUID(),
        token: null
      }

      await database.db.insert(invitations).values(record).run()
      return cloneInvitation(record)
    },
    async findInvitation(id: string) {
      const row = await database.db.select().from(invitations).where(eq(invitations.id, id)).get()
      return row ? cloneInvitation(mapInvitation(row)) : null
    },
    async listInvitationsByBoardId(boardId: string) {
      const rows = await database.db
        .select()
        .from(invitations)
        .where(eq(invitations.boardId, boardId))
        .orderBy(asc(invitations.createdAt))
        .all()

      return rows.map((row) => cloneInvitation(mapInvitation(row)))
    },
    async attachInvitationToken(id: string, token: string) {
      await database.db
        .update(invitations)
        .set({ token })
        .where(eq(invitations.id, id))
        .run()

      return await store.findInvitation(id)
    },
    async revokeInvitation(id: string) {
      await database.db
        .update(invitations)
        .set({ revoked: true })
        .where(eq(invitations.id, id))
        .run()

      return await store.findInvitation(id)
    }
  }

  return store
}
