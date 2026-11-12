import type { AccountEntitlements, WorkspaceEntitlements } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { DocumentNotFoundError } from '#cloud/server/documents/errors'
import { workspaceRole } from '#cloud/server/documents/repository'
import { createStorageQuotaService, type StorageQuotaSnapshot } from '#cloud/server/quota'
import type { Kysely } from 'kysely'

import { CLOUD_FEATURE_KEYS, type CloudPolicyContext } from './keys'
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
    /** A workspace's entitlements: its owner's plan and pooled storage, for any member to read. */
    async workspace(userId: string, workspaceId: string): Promise<WorkspaceEntitlements> {
      if (!(await workspaceRole(database, userId, workspaceId))) throw new DocumentNotFoundError()
      const context = await workspacePolicyContext(
        database,
        { workspaceId },
        { actorId: userId, deploymentMode: 'self-hosted' }
      )
      if (!context) throw new DocumentNotFoundError()
      const [entitlements, usage] = await Promise.all([
        resolve(context),
        quota.snapshot(workspaceId)
      ])
      // The workspace may have gone since its role was read; it has no usage to report then.
      if (!usage) throw new DocumentNotFoundError()
      return { ...entitlements, usage: storageUsage(usage) }
    },

    /** The signed-in account's own plan, and the storage its workspaces hold together. */
    async account(userId: string): Promise<AccountEntitlements> {
      const [entitlements, usage] = await Promise.all([
        resolve({
          targetingKey: userId,
          subjectType: 'user',
          actorId: userId,
          deploymentMode: 'self-hosted'
        }),
        quota.account(userId)
      ])
      return { ...entitlements, usage: storageUsage(usage) }
    }
  }

  async function resolve(
    context: CloudPolicyContext
  ): Promise<Omit<WorkspaceEntitlements, 'usage'>> {
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
      monthlyCreditAllowance
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
      policy.number(CLOUD_FEATURE_KEYS.maximumParticipants, technicalMaximumParticipants, context),
      policy.number(CLOUD_FEATURE_KEYS.monthlyCreditAllowance, -1, context)
    ])
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
      }
    }
  }
}

function storageUsage(usage: StorageQuotaSnapshot): WorkspaceEntitlements['usage'] {
  return { committedStorageBytes: usage.committedBytes, reservedStorageBytes: usage.reservedBytes }
}

export type EntitlementService = ReturnType<typeof createEntitlementService>
