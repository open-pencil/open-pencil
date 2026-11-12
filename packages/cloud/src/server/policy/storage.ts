import type { CloudDatabase } from '#cloud/server/db'
import { createStorageQuotaService } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

import { CLOUD_FEATURE_KEYS } from './keys'
import type { CloudPolicy } from './policy'
import { workspacePolicyContext } from './workspace'

/**
 * Whether the owner of a workspace, or of a document's workspace, holds as much as their plan's
 * storage allows or more. Their workspaces are then read-only until they free space or their plan
 * grows: documents open and download, and can be deleted, but take no edits, uploads, or new
 * documents. A plan that shrinks below what an account holds, as when a subscription lapses,
 * reaches this the same way as filling it.
 */
export async function storageLimitReached(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy | undefined,
  target: { workspaceId: string } | { documentId: string },
  deploymentMode: 'official' | 'self-hosted' = 'self-hosted'
): Promise<boolean> {
  if (!policy) return false
  const context = await workspacePolicyContext(database, target, { deploymentMode })
  if (!context) return false
  const maximum = await policy.number(
    CLOUD_FEATURE_KEYS.maximumStorageBytes,
    Number.MAX_SAFE_INTEGER,
    context
  )
  if (maximum === Number.MAX_SAFE_INTEGER) return false
  const usage = await createStorageQuotaService(database).snapshot(context.workspaceId)
  return usage !== null && usage.committedBytes >= maximum
}
