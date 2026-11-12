import type { CloudDatabase } from '#cloud/server/db'
import { canEditDocument, resolveDocumentAccess } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import type { DocumentServiceOptions } from '#cloud/server/documents/service'
import { documentSummary, getDocumentSummaryRow } from '#cloud/server/documents/summary'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import { storageLimitReached } from '#cloud/server/policy/storage'
import { workspacePolicyContext } from '#cloud/server/policy/workspace'
import { StorageQuotaExceededError } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

/**
 * The document `userId` may write to, and how large one file and its owner's storage may be for
 * this save: technical limits, tightened by the owner's plan. An owner who holds their whole
 * storage allowance or more is read-only, so nothing of theirs takes a save, however small.
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
  const policyContext = await workspacePolicyContext(
    database,
    { documentId },
    { actorId: userId, deploymentMode: 'self-hosted' }
  )
  if (!policyContext) throw new DocumentNotFoundError()
  if (await storageLimitReached(database, options.policy, { documentId })) {
    throw new StorageQuotaExceededError('The owner holds their whole storage allowance')
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
