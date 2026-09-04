import type { WorkspaceEntitlements } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { workspaceRole } from '#cloud/server/documents/repository'
import { DocumentNotFoundError } from '#cloud/server/documents/service'
import { createStorageQuotaService } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

import { CLOUD_FEATURE_KEYS } from './keys'
import type { CloudPolicy } from './policy'

export function createEntitlementService(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy,
  technicalMaximumFileBytes: number
) {
  const quota = createStorageQuotaService(database)
  return {
    async workspace(userId: string, workspaceId: string): Promise<WorkspaceEntitlements> {
      if (!(await workspaceRole(database, userId, workspaceId))) throw new DocumentNotFoundError()
      const context = {
        targetingKey: workspaceId,
        actorId: userId,
        workspaceId,
        deploymentMode: 'self-hosted' as const
      }
      const [
        capabilityLinks,
        anonymousView,
        anonymousEdit,
        guestPresence,
        collaboration,
        revisionHistory,
        maximumFileBytes,
        maximumStorage,
        maximumParticipants,
        usage
      ] = await Promise.all([
        policy.boolean(CLOUD_FEATURE_KEYS.capabilityLinks, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.anonymousView, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.anonymousEdit, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.guestPresence, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.collaboration, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.revisionHistory, false, context),
        policy.number(CLOUD_FEATURE_KEYS.maximumFileBytes, technicalMaximumFileBytes, context),
        policy.number(CLOUD_FEATURE_KEYS.maximumStorageBytes, Number.MAX_SAFE_INTEGER, context),
        policy.number(CLOUD_FEATURE_KEYS.maximumParticipants, Number.MAX_SAFE_INTEGER, context),
        quota.snapshot(workspaceId)
      ])
      return {
        features: {
          capabilityLinks,
          anonymousView,
          anonymousEdit,
          guestPresence,
          collaboration,
          revisionHistory
        },
        limits: {
          maximumFileBytes: Math.min(technicalMaximumFileBytes, maximumFileBytes),
          maximumStorageBytes: maximumStorage === Number.MAX_SAFE_INTEGER ? null : maximumStorage,
          maximumParticipants:
            maximumParticipants === Number.MAX_SAFE_INTEGER ? null : maximumParticipants
        },
        usage: {
          committedStorageBytes: usage.committedBytes,
          reservedStorageBytes: usage.reservedBytes
        }
      }
    }
  }
}

export type EntitlementService = ReturnType<typeof createEntitlementService>
