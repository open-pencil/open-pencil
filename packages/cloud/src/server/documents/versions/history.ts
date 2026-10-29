import { CLOUD_FEATURE_KEYS, type CloudPolicyContext } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'

/** How far back a workspace without full revision history keeps its versions. */
export const LIMITED_HISTORY_DAYS = 30

/**
 * The oldest moment a workspace's history reaches, or null when it keeps everything: with the
 * `revisionHistory` entitlement off, only the last 30 days, as on a free plan.
 */
export async function historyStart(
  policy: CloudPolicy | undefined,
  deploymentMode: CloudPolicyContext['deploymentMode'],
  workspaceId: string,
  now: Date
): Promise<Date | null> {
  const full = policy
    ? await policy.boolean(CLOUD_FEATURE_KEYS.revisionHistory, true, {
        targetingKey: workspaceId,
        workspaceId,
        deploymentMode
      })
    : true
  return full ? null : new Date(now.getTime() - LIMITED_HISTORY_DAYS * 24 * 60 * 60_000)
}
