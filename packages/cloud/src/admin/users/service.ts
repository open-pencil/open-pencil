import { AdminDomainError } from '#cloud/admin/errors'
import type { CloudAuthAdapter } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export function createAdminUserService(
  database: Kysely<CloudDatabase>,
  auth: CloudAuthAdapter,
  options: { requireMFA?: boolean } = {}
) {
  async function audit(actorId: string, action: string, userId: string): Promise<void> {
    await database
      .insertInto('cloudAdminAuditEvent')
      .values({
        id: crypto.randomUUID(),
        actorUserId: actorId,
        action,
        subjectType: 'user',
        subjectId: userId,
        metadata: {}
      })
      .execute()
  }

  async function requireSafeTarget(
    actorId: string,
    userId: string,
    action: 'ban' | 'demote'
  ): Promise<void> {
    if (actorId === userId) {
      throw new AdminDomainError(
        'self_admin_action_forbidden',
        `Administrators cannot ${action} themselves`
      )
    }
    const target = await database
      .selectFrom('user')
      .select('role')
      .where('id', '=', userId)
      .executeTakeFirst()
    if (target?.role !== 'admin') return
    const count = await database
      .selectFrom('user')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('role', '=', 'admin')
      .where((expression) =>
        expression.or([expression('banned', '=', false), expression('banned', 'is', null)])
      )
      .executeTakeFirstOrThrow()
    if (Number(count.count) <= 1) {
      throw new AdminDomainError(
        'last_admin_required',
        'Cannot remove the last deployment administrator'
      )
    }
  }

  return {
    list(headers: Headers, query?: { searchValue?: string; limit?: number; offset?: number }) {
      return auth.listUsers(headers, query)
    },
    async ban(headers: Headers, actorId: string, userId: string, reason?: string): Promise<void> {
      await requireSafeTarget(actorId, userId, 'ban')
      await auth.banUser(headers, userId, reason)
      await audit(actorId, 'user.banned', userId)
    },
    async unban(headers: Headers, actorId: string, userId: string): Promise<void> {
      await auth.unbanUser(headers, userId)
      await audit(actorId, 'user.unbanned', userId)
    },
    async revokeSessions(headers: Headers, actorId: string, userId: string): Promise<void> {
      await auth.revokeUserSessions(headers, userId)
      await audit(actorId, 'user.sessions-revoked', userId)
    },
    async setAdmin(
      headers: Headers,
      actorId: string,
      userId: string,
      enabled: boolean
    ): Promise<void> {
      if (!enabled) await requireSafeTarget(actorId, userId, 'demote')
      if (enabled && options.requireMFA) {
        const user = await database
          .selectFrom('user')
          .select('twoFactorEnabled')
          .where('id', '=', userId)
          .executeTakeFirst()
        const passkey = await database
          .selectFrom('passkey')
          .select('id')
          .where('userId', '=', userId)
          .executeTakeFirst()
        if (!user?.twoFactorEnabled && !passkey) {
          throw new AdminDomainError(
            'mfa_required',
            'Users must enroll MFA before becoming deployment administrators'
          )
        }
      }
      await auth.setRole(headers, userId, enabled ? 'admin' : 'user')
      await audit(actorId, enabled ? 'user.admin-granted' : 'user.admin-revoked', userId)
    }
  }
}

export type AdminUserService = ReturnType<typeof createAdminUserService>
