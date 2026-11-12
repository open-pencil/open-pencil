import { CLOUD_ACCOUNT_PLAN_PATH } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import { CLOUD_FEATURE_KEYS } from '#cloud/server/policy/keys'
import type { CloudPolicy } from '#cloud/server/policy/policy'
import type { Kysely } from 'kysely'

export type StorageLimitNoticeResult = {
  /** Accounts told this pass that their storage is full. */
  notified: number
  /** Accounts back under their plan, which are told again if they fill it again. */
  cleared: number
}

export type StorageLimitNoticeOptions = {
  policy: CloudPolicy
  email: TransactionalEmailService
  publicURL: string
  /** Whether the server sells plans, so the email offers more storage. */
  upgradable: boolean
  deploymentMode: 'official' | 'self-hosted'
}

/**
 * Emails each account once when it holds all the storage its plan allows, which makes its
 * workspaces read-only (`storageLimitReached`), whether it filled its plan or its plan shrank below
 * what it holds, as when a subscription lapses. A pass compares every owner's committed storage
 * with their plan, so it reaches both however the plan changed.
 */
export function createStorageLimitNoticeService(
  database: Kysely<CloudDatabase>,
  options: StorageLimitNoticeOptions
) {
  /** Each account's limit, or null when its plan sets none. */
  async function limit(userId: string): Promise<number | null> {
    const maximum = await options.policy.number(
      CLOUD_FEATURE_KEYS.maximumStorageBytes,
      Number.MAX_SAFE_INTEGER,
      { targetingKey: userId, subjectType: 'user', deploymentMode: options.deploymentMode }
    )
    return maximum === Number.MAX_SAFE_INTEGER ? null : maximum
  }

  async function notify(userId: string, usedBytes: number, limitBytes: number): Promise<boolean> {
    return database.transaction().execute(async (transaction) => {
      const notice = await transaction
        .insertInto('storageLimitNotice')
        .values({ userId })
        .onConflict((conflict) => conflict.column('userId').doNothing())
        .returning('notifiedAt')
        .executeTakeFirst()
      if (!notice) return false
      const user = await transaction
        .selectFrom('user')
        .select(['name', 'email'])
        .where('id', '=', userId)
        .executeTakeFirst()
      if (!user) return false
      await options.email.enqueue(
        {
          idempotencyKey: `storage-limit-reached/${userId}/${new Date(notice.notifiedAt).getTime()}`,
          kind: 'storage-limit-reached',
          recipientEmail: user.email,
          payload: {
            name: user.name,
            usedBytes,
            limitBytes,
            upgradable: options.upgradable,
            actionURL: new URL(
              options.upgradable ? CLOUD_ACCOUNT_PLAN_PATH : '/',
              options.publicURL
            ).href
          }
        },
        transaction
      )
      return true
    })
  }

  return {
    async notifyStorageLimits(): Promise<StorageLimitNoticeResult> {
      const [owners, notices] = await Promise.all([
        database
          .selectFrom('workspace')
          .innerJoin('workspaceStorageUsage', 'workspaceStorageUsage.workspaceId', 'workspace.id')
          .select((expression) => [
            'workspace.ownerId',
            expression.fn.sum<string | number>('workspaceStorageUsage.committedBytes').as('bytes')
          ])
          .groupBy('workspace.ownerId')
          .execute(),
        database.selectFrom('storageLimitNotice').select('userId').execute()
      ])
      const usage = new Map(owners.map((owner) => [owner.ownerId, Number(owner.bytes)]))
      const result: StorageLimitNoticeResult = { notified: 0, cleared: 0 }
      for (const [userId, usedBytes] of usage) {
        const limitBytes = await limit(userId)
        if (limitBytes !== null && usedBytes >= limitBytes) {
          if (await notify(userId, usedBytes, limitBytes)) result.notified++
        }
      }
      // A notice whose account holds less than its plan allows again, or nothing at all, is done.
      for (const { userId } of notices) {
        const usedBytes = usage.get(userId) ?? 0
        const limitBytes = await limit(userId)
        if (limitBytes !== null && usedBytes >= limitBytes) continue
        await database.deleteFrom('storageLimitNotice').where('userId', '=', userId).execute()
        result.cleared++
      }
      return result
    }
  }
}

export type StorageLimitNoticeService = ReturnType<typeof createStorageLimitNoticeService>
