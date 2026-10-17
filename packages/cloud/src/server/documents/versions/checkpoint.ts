import type { CloudDatabase } from '#cloud/server/db'
import type { Transaction } from 'kysely'

/** How long the newest version may be old before a save keeps the state it replaces. */
export const CHECKPOINT_INTERVAL_MS = 30 * 60_000

/** Keeps a revision in the history, unless a version already keeps it. */
export async function keepRevision(
  transaction: Transaction<CloudDatabase>,
  input: {
    documentId: string
    revisionId: string
    createdBy: string
    createdAt: Date
    restoredFromVersionId?: string
  }
): Promise<void> {
  await transaction
    .insertInto('documentVersion')
    .values({
      id: crypto.randomUUID(),
      documentId: input.documentId,
      revisionId: input.revisionId,
      kind: 'checkpoint',
      name: null,
      description: null,
      createdBy: input.createdBy,
      restoredFromVersionId: input.restoredFromVersionId ?? null,
      createdAt: input.createdAt
    })
    .onConflict((conflict) => conflict.column('revisionId').doNothing())
    .execute()
}

/**
 * Records the history's checkpoints as a save lands: the document's first save, and the state a
 * save replaces once the newest version is half an hour old. Each stretch of editing, and how the
 * document was left at the end of every session, stays in the history; the saves between them are
 * compacted later.
 */
export async function recordCheckpoint(
  transaction: Transaction<CloudDatabase>,
  input: {
    documentId: string
    previousRevisionId: string | null
    revisionId: string
    userId: string
    now: Date
  }
): Promise<void> {
  if (!input.previousRevisionId) {
    await keepRevision(transaction, {
      documentId: input.documentId,
      revisionId: input.revisionId,
      createdBy: input.userId,
      createdAt: input.now
    })
    return
  }
  const newest = await transaction
    .selectFrom('documentVersion')
    .select('createdAt')
    .where('documentId', '=', input.documentId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .executeTakeFirst()
  if (newest && newest.createdAt.getTime() > input.now.getTime() - CHECKPOINT_INTERVAL_MS) return
  const previous = await transaction
    .selectFrom('documentRevision')
    .select(['createdBy', 'createdAt'])
    .where('id', '=', input.previousRevisionId)
    .executeTakeFirst()
  if (!previous) return
  await keepRevision(transaction, {
    documentId: input.documentId,
    revisionId: input.previousRevisionId,
    createdBy: previous.createdBy,
    createdAt: previous.createdAt
  })
}
