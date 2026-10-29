import type { CloudDatabase } from '#cloud/server/db'
import { canEditDocument, resolveDocumentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import type { DocumentServiceOptions } from '#cloud/server/documents/service'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { Kysely } from 'kysely'

/**
 * The document `userId` may write to, and how large one file and the workspace's storage may
 * be for this save: technical limits, tightened by policy.
 */
export async function writableDocument(
  database: Kysely<CloudDatabase>,
  options: Pick<DocumentServiceOptions, 'policy' | 'technicalMaximumUploadBytes'>,
  userId: string,
  documentId: string
) {
  const access = await resolveDocumentAccess(database, userId, documentId)
  if (!access) throw new DocumentNotFoundError()
  if (!canEditDocument(access)) throw new DocumentForbiddenError()
  // Access was resolved just above, so the document is read without resolving it again.
  const row = await getDocumentSummaryRow(database, documentId)
  if (!row) throw new DocumentNotFoundError()
  const document = documentSummary(row)
  const policyContext = {
    targetingKey: document.workspaceId,
    actorId: userId,
    workspaceId: document.workspaceId,
    documentId,
    deploymentMode: 'self-hosted' as const
  }
  const technicalMaximum = options.technicalMaximumUploadBytes ?? Number.MAX_SAFE_INTEGER
  const maximumFileBytes = Math.min(
    technicalMaximum,
    options.policy
      ? await options.policy.number(
          CLOUD_FEATURE_KEYS.maximumFileBytes,
          technicalMaximum,
          policyContext
        )
      : technicalMaximum
  )
  const maximumStorageBytes = options.policy
    ? await options.policy.number(
        CLOUD_FEATURE_KEYS.maximumStorageBytes,
        Number.MAX_SAFE_INTEGER,
        policyContext
      )
    : Number.MAX_SAFE_INTEGER
  return {
    document,
    maximumFileBytes,
    maximumStorageBytes:
      maximumStorageBytes === Number.MAX_SAFE_INTEGER ? null : maximumStorageBytes
  }
}
