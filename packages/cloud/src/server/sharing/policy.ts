import type { DocumentPermission } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentForbiddenError } from '#cloud/server/documents/service'
import { CLOUD_FEATURE_KEYS, type CloudPolicy, type CloudPolicyContext } from '#cloud/server/policy'
import type { Kysely } from 'kysely'

export type SharingPolicyOptions = {
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export type CapabilityLinkPolicyInput = {
  actorId: string
  documentId: string
  permission: DocumentPermission
}

export function createSharingPolicy(
  database: Kysely<CloudDatabase>,
  options: SharingPolicyOptions
) {
  async function requireCapabilityLink(input: CapabilityLinkPolicyInput): Promise<void> {
    if (!options.policy) return
    const document = await database
      .selectFrom('document')
      .select('workspaceId')
      .where('id', '=', input.documentId)
      .executeTakeFirstOrThrow()
    const context: CloudPolicyContext = {
      targetingKey: document.workspaceId,
      actorId: input.actorId,
      workspaceId: document.workspaceId,
      documentId: input.documentId,
      deploymentMode: options.deploymentMode ?? 'self-hosted'
    }
    if (!(await options.policy.boolean(CLOUD_FEATURE_KEYS.capabilityLinks, false, context))) {
      throw new DocumentForbiddenError()
    }
    if (
      input.permission === 'edit' &&
      !(await options.policy.boolean(CLOUD_FEATURE_KEYS.anonymousEdit, false, context))
    ) {
      throw new DocumentForbiddenError()
    }
  }

  return { requireCapabilityLink }
}

export type SharingPolicy = ReturnType<typeof createSharingPolicy>
