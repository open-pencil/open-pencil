import type { CloudDatabase } from '#cloud/server/db'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import { CLOUD_FEATURE_KEYS, type CloudPolicy } from '#cloud/server/policy'
import { workspacePolicyContext } from '#cloud/server/policy/workspace'
import type { Kysely } from 'kysely'

export type SharingPolicyOptions = {
  policy?: CloudPolicy
  deploymentMode?: 'official' | 'self-hosted'
}

export type CapabilityLinkPolicyInput = {
  actorId: string
  documentId: string
}

export function createSharingPolicy(
  database: Kysely<CloudDatabase>,
  options: SharingPolicyOptions
) {
  async function requireCapabilityLink(input: CapabilityLinkPolicyInput): Promise<void> {
    if (!options.policy) return
    const context = await workspacePolicyContext(
      database,
      { documentId: input.documentId },
      { actorId: input.actorId, deploymentMode: options.deploymentMode ?? 'self-hosted' }
    )
    if (!context) throw new DocumentNotFoundError()
    // Whether guests may follow the link is checked when they do, so edit links still work for
    // people signed in to the server.
    if (!(await options.policy.boolean(CLOUD_FEATURE_KEYS.links, false, context))) {
      throw new DocumentForbiddenError()
    }
  }

  return { requireCapabilityLink }
}

export type SharingPolicy = ReturnType<typeof createSharingPolicy>
