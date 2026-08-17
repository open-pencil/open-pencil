import type { CloudDatabase } from '#cloud/server/db'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/service'
import type { Kysely } from 'kysely'

import { resolveDocumentAccess } from '../documents/access'

export async function requireSharingAccess(
  database: Kysely<CloudDatabase>,
  userId: string,
  documentId: string
): Promise<void> {
  const access = await resolveDocumentAccess(database, userId, documentId)
  if (!access) throw new DocumentNotFoundError()
  if (!access.canManageSharing) throw new DocumentForbiddenError()
}
