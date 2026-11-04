import type { CloudDatabase } from '#cloud/server/db'
import { resolveDocumentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import type { Kysely } from 'kysely'

export async function requireSharingAccess(
  database: Kysely<CloudDatabase>,
  userId: string,
  documentId: string
): Promise<void> {
  const access = await resolveDocumentAccess(database, userId, documentId)
  if (!access) throw new DocumentNotFoundError()
  if (!access.canManageSharing) throw new DocumentForbiddenError()
}

/**
 * Ends every collaboration ticket and room key issued for the document so far: removing someone's
 * access must also remove them from its live room.
 */
export async function advanceCollaborationEpoch(
  database: Kysely<CloudDatabase>,
  documentId: string
): Promise<void> {
  await database
    .updateTable('document')
    .set({ collaborationEpoch: (expression) => expression('collaborationEpoch', '+', 1) })
    .where('id', '=', documentId)
    .executeTakeFirst()
}
