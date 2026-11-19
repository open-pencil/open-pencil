import type { CloudDatabase } from '#cloud/server/db'
import { CLOUD_FEATURE_KEYS, type CloudPolicyContext } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import { workspacePolicyContext } from '#cloud/server/policy/workspace'
import type { Kysely } from 'kysely'

/** How far back a workspace without full revision history keeps its versions. */
export const LIMITED_HISTORY_DAYS = 30

/**
 * The oldest moment a workspace's history reaches, or null when it keeps everything: with the
 * `revisionHistory` entitlement off, only the last 30 days, as on a free plan.
 */
export async function historyStart(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy | undefined,
  deploymentMode: CloudPolicyContext['deploymentMode'],
  workspaceId: string,
  now: Date
): Promise<Date | null> {
  const context = policy
    ? await workspacePolicyContext(database, { workspaceId }, { deploymentMode })
    : null
  const full =
    policy && context
      ? await policy.boolean(CLOUD_FEATURE_KEYS.revisionHistory, true, context)
      : true
  return full ? null : new Date(now.getTime() - LIMITED_HISTORY_DAYS * 24 * 60 * 60_000)
}
