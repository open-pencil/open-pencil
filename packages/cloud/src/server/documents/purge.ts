import { documentObjects } from '#cloud/server/cleanup/documents'
import type { CloudDatabase } from '#cloud/server/db'
import { sumBy } from 'es-toolkit'
import type { Transaction } from 'kysely'

/**
 * Deleting forever: deleted documents leave everyone's sight, Trash included, and the files only
 * they hold come off their workspaces' usage at once. Their files and rows stay through the
 * deployment's grace, so a server administrator can still bring them back, then cleanup destroys
 * them and takes off only what this did not. `purgedBy` is empty for an account's deletion.
 */
export async function markPurged(
  transaction: Transaction<CloudDatabase>,
  documentIds: readonly string[],
  purgedBy: string | null,
  now: Date
): Promise<void> {
  for (const documentId of documentIds) {
    const document = await transaction
      .selectFrom('document')
      .select('workspaceId')
      .where('id', '=', documentId)
      .where('purgedAt', 'is', null)
      .executeTakeFirst()
    if (!document) continue
    const bytes = sumBy(await documentObjects(transaction, documentId), (object) => object.byteSize)
    await transaction
      .updateTable('document')
      .set({ purgedAt: now, purgedBy, purgedBytes: bytes })
      .where('id', '=', documentId)
      .execute()
    if (bytes > 0) await changeUsage(transaction, document.workspaceId, -bytes)
  }
}

/**
 * Brings a document deleted forever back to life in its workspace: it is live again, and the
 * storage deleting it took off counts again.
 */
export async function unmarkPurged(
  transaction: Transaction<CloudDatabase>,
  document: { id: string; workspaceId: string; purgedBytes: number }
): Promise<void> {
  await transaction
    .updateTable('document')
    // Changed now, so devices that deleted it stop hiding it.
    .set({
      deletedAt: null,
      deletedBy: null,
      purgedAt: null,
      purgedBy: null,
      purgedBytes: 0,
      updatedAt: new Date()
    })
    .where('id', '=', document.id)
    .execute()
  if (document.purgedBytes > 0) {
    await changeUsage(transaction, document.workspaceId, document.purgedBytes)
  }
}

async function changeUsage(
  transaction: Transaction<CloudDatabase>,
  workspaceId: string,
  bytes: number
): Promise<void> {
  await transaction
    .updateTable('workspaceStorageUsage')
    .set({
      committedBytes: (expression) => expression('committedBytes', '+', bytes),
      updatedAt: new Date()
    })
    .where('workspaceId', '=', workspaceId)
    .execute()
}
