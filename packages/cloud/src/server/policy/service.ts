import type { WorkspaceEntitlements } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { workspaceRole } from '#cloud/server/documents/repository'
import { createStorageQuotaService } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

import { CLOUD_FEATURE_KEYS } from './keys'
import type { CloudPolicy } from './policy'
import { workspacePolicyContext } from './workspace'

export function createEntitlementService(
  database: Kysely<CloudDatabase>,
  policy: CloudPolicy,
  technicalMaximumFileBytes: number,
  technicalMaximumParticipants = Number.MAX_SAFE_INTEGER
) {
  const quota = createStorageQuotaService(database)
  return {
    async workspace(userId: string, workspaceId: string): Promise<WorkspaceEntitlements> {
      if (!(await workspaceRole(database, userId, workspaceId))) throw new DocumentNotFoundError()
      const context = await workspacePolicyContext(
        database,
        { workspaceId },
        { actorId: userId, deploymentMode: 'self-hosted' }
      )
      if (!context) throw new DocumentNotFoundError()
      const [
        links,
        guestView,
        guestEdit,
        guestPresence,
        collaboration,
        revisionHistory,
        cloudServices,
        maximumFileBytes,
        maximumStorage,
        maximumParticipants,
        monthlyCreditAllowance,
        usage
      ] = await Promise.all([
        policy.boolean(CLOUD_FEATURE_KEYS.links, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.guestView, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.guestEdit, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.guestPresence, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.collaboration, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.revisionHistory, false, context),
        policy.boolean(CLOUD_FEATURE_KEYS.cloudServices, false, context),
        policy.number(CLOUD_FEATURE_KEYS.maximumFileBytes, technicalMaximumFileBytes, context),
        policy.number(CLOUD_FEATURE_KEYS.maximumStorageBytes, Number.MAX_SAFE_INTEGER, context),
        policy.number(
          CLOUD_FEATURE_KEYS.maximumParticipants,
          technicalMaximumParticipants,
          context
        ),
        policy.number(CLOUD_FEATURE_KEYS.monthlyCreditAllowance, -1, context),
        quota.snapshot(workspaceId)
      ])
      // The workspace may have gone since its role was read; it has no usage to report then.
      if (!usage) throw new DocumentNotFoundError()
      // Technical limits are ceilings: an entitlement can lower them but never raise them.
      const participants = Math.min(technicalMaximumParticipants, maximumParticipants)
      return {
        features: {
          links,
          guestView,
          guestEdit,
          guestPresence,
          collaboration,
          revisionHistory,
          cloudServices
        },
        limits: {
          maximumFileBytes: Math.min(technicalMaximumFileBytes, maximumFileBytes),
          maximumStorageBytes: maximumStorage === Number.MAX_SAFE_INTEGER ? null : maximumStorage,
          maximumParticipants: participants === Number.MAX_SAFE_INTEGER ? null : participants,
          monthlyCreditAllowance: monthlyCreditAllowance < 0 ? null : monthlyCreditAllowance
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
