import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

import type { CloudPolicyContext } from './keys'

type WorkspacePolicyTarget = { workspaceId: string } | { documentId: string }

/**
 * The policy context for a workspace, or for a document by its workspace: its owner's plan, which
 * every workspace they own takes, so creating more workspaces adds no allowance. Null when the
 * workspace or document is gone.
 */
export async function workspacePolicyContext(
  database: Kysely<CloudDatabase> | Transaction<CloudDatabase>,
  target: WorkspacePolicyTarget,
  context: Pick<CloudPolicyContext, 'actorId' | 'deploymentMode'>
): Promise<(CloudPolicyContext & { workspaceId: string }) | null> {
  const row =
    'documentId' in target
      ? await database
          .selectFrom('document')
          .innerJoin('workspace', 'workspace.id', 'document.workspaceId')
          .select(['workspace.id as workspaceId', 'workspace.ownerId'])
          .where('document.id', '=', target.documentId)
          .executeTakeFirst()
      : await database
          .selectFrom('workspace')
          .select(['id as workspaceId', 'ownerId'])
          .where('id', '=', target.workspaceId)
          .executeTakeFirst()
  if (!row) return null
  const policyContext: CloudPolicyContext & { workspaceId: string } = {
    targetingKey: row.ownerId,
    subjectType: 'user',
    workspaceId: row.workspaceId,
    deploymentMode: context.deploymentMode
  }
  if (context.actorId) policyContext.actorId = context.actorId
  if ('documentId' in target) policyContext.documentId = target.documentId
  return policyContext
}
