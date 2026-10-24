import { AdminDomainError } from '#cloud/admin/errors'
import { ADMIN_LIST_MAXIMUM } from '#cloud/admin/schema'
import type { CloudAdminUser, CloudAdminUserDetail, CloudAdminUserFilter } from '#cloud/contract'
import {
  createSignInActivity,
  type AuthenticationEmailService,
  type CloudAuthAdapter
} from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { dateString } from '#cloud/server/sharing/contracts'
import { clamp, countBy, keyBy } from 'es-toolkit'
import type { ExpressionBuilder, Kysely } from 'kysely'

/** The sign-ins a person's page lists. */
const DETAIL_SIGN_INS = 20

const FILTERS = ['all', 'administrators', 'suspended', 'without-two-step'] as const

type UserExpression = ExpressionBuilder<CloudDatabase, 'user'>

/** A search for part of a name or email, matched literally and without case. */
function searchCondition(search: string) {
  const pattern = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
  return (expression: UserExpression) =>
    expression.or([
      expression('user.email', 'ilike', pattern),
      expression('user.name', 'ilike', pattern)
    ])
}

function filterCondition(filter: CloudAdminUserFilter) {
  return (expression: UserExpression) => {
    if (filter === 'administrators') return expression('user.role', '=', 'admin')
    if (filter === 'suspended') return expression('user.banned', '=', true)
    if (filter === 'without-two-step') {
      return expression.and([
        // Better Auth leaves the flag unset on accounts that never turned it on.
        expression('user.twoFactorEnabled', 'is not', true),
        expression.not(
          expression.exists(
            expression
              .selectFrom('passkey')
              .select('passkey.id')
              .whereRef('passkey.userId', '=', 'user.id')
          )
        )
      ])
    }
    return expression.lit(true)
  }
}

export type AdminUserQuery = {
  search?: string
  filter?: CloudAdminUserFilter
  limit?: number
  offset?: number
}

type UserRow = {
  id: string
  name: string
  email: string
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  twoFactorEnabled: boolean | null
  createdAt: Date | string
}

export function createAdminUserService(
  database: Kysely<CloudDatabase>,
  auth: CloudAuthAdapter,
  options: { requireMFA?: boolean; notify?: AuthenticationEmailService } = {}
) {
  const activity = createSignInActivity(database)

  async function audit(
    actorId: string,
    action: string,
    userId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await database
      .insertInto('adminAuditEvent')
      .values({
        id: crypto.randomUUID(),
        actorUserId: actorId,
        action,
        subjectType: 'user',
        subjectId: userId,
        metadata
      })
      .execute()
  }

  function refuseSelf(actorId: string, userId: string, action: string): void {
    if (actorId === userId) {
      throw new AdminDomainError(
        'self_admin_action_forbidden',
        `Administrators cannot ${action} themselves`
      )
    }
  }

  async function requireSafeTarget(
    actorId: string,
    userId: string,
    action: 'ban' | 'demote'
  ): Promise<void> {
    refuseSelf(actorId, userId, action)
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

  /** What the list shows about each account beyond its own row. */
  async function accountSummaries(rows: UserRow[]): Promise<CloudAdminUser[]> {
    const ids = rows.map((row) => row.id)
    if (ids.length === 0) return []
    const [passkeys, sessions, memberships] = await Promise.all([
      database.selectFrom('passkey').select('userId').where('userId', 'in', ids).execute(),
      database
        .selectFrom('session')
        .select(({ fn }) => ['session.userId', fn.max('session.updatedAt').as('lastActiveAt')])
        .where('session.userId', 'in', ids)
        .where('session.expiresAt', '>', new Date())
        .groupBy('session.userId')
        .execute(),
      database.selectFrom('workspaceMember').select('userId').where('userId', 'in', ids).execute()
    ])
    const withPasskeys = new Set(passkeys.map((passkey) => passkey.userId))
    const lastActive = keyBy(sessions, (session) => session.userId)
    const workspaceCounts = countBy(memberships, (membership) => membership.userId)
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role ?? undefined,
      banned: row.banned,
      banReason: row.banReason,
      createdAt: dateString(row.createdAt) ?? '',
      twoStep: row.twoFactorEnabled === true || withPasskeys.has(row.id),
      lastActiveAt: dateString(lastActive[row.id]?.lastActiveAt ?? null),
      workspaceCount: workspaceCounts[row.id] ?? 0
    }))
  }

  const userColumns = [
    'user.id',
    'user.name',
    'user.email',
    'user.image',
    'user.role',
    'user.banned',
    'user.banReason',
    'user.twoFactorEnabled',
    'user.emailVerified',
    'user.createdAt'
  ] as const

  return {
    /** A page of accounts in sign-up order, with how many match the search under each filter. */
    async list(query: AdminUserQuery = {}) {
      const search = query.search?.trim()
      const filter = query.filter ?? 'all'
      const matching = (target: CloudAdminUserFilter) => {
        let selection = database.selectFrom('user').where(filterCondition(target))
        if (search) selection = selection.where(searchCondition(search))
        return selection
      }
      const counts = await Promise.all(
        FILTERS.map(async (target) => {
          const row = await matching(target)
            .select(({ fn }) => fn.countAll<number>().as('count'))
            .executeTakeFirstOrThrow()
          return Number(row.count)
        })
      )
      const [all = 0, administrators = 0, suspended = 0, withoutTwoStep = 0] = counts
      const countsByFilter = {
        all,
        administrators,
        suspended,
        'without-two-step': withoutTwoStep
      }
      const rows = await matching(filter)
        .select(userColumns)
        .orderBy('user.createdAt')
        .orderBy('user.id')
        .limit(clamp(query.limit ?? 50, 1, ADMIN_LIST_MAXIMUM))
        .offset(Math.max(0, query.offset ?? 0))
        .execute()
      return {
        users: await accountSummaries(rows),
        total: countsByFilter[filter],
        counts: countsByFilter
      }
    },

    /** Everything an administrator reads about one account; null when there is none. */
    async detail(userId: string): Promise<CloudAdminUserDetail | null> {
      const row = await database
        .selectFrom('user')
        .select(userColumns)
        .where('user.id', '=', userId)
        .executeTakeFirst()
      if (!row) return null
      const [[summary], methods, passkeys, sessions, signIns, workspaces] = await Promise.all([
        accountSummaries([row]),
        database
          .selectFrom('account')
          .select(['providerId', 'createdAt'])
          .where('userId', '=', userId)
          .orderBy('createdAt')
          .execute(),
        database
          .selectFrom('passkey')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .where('userId', '=', userId)
          .executeTakeFirstOrThrow(),
        activity.sessions(userId, ''),
        activity.signIns(userId, DETAIL_SIGN_INS),
        database
          .selectFrom('workspaceMember')
          .innerJoin('workspace', 'workspace.id', 'workspaceMember.workspaceId')
          .select((expression) => [
            'workspace.id',
            'workspace.name',
            'workspaceMember.role',
            'workspaceMember.createdAt',
            expression
              .selectFrom('workspaceMember as member')
              .select(({ fn }) => fn.countAll<number>().as('count'))
              .whereRef('member.workspaceId', '=', 'workspace.id')
              .as('memberCount')
          ])
          .where('workspaceMember.userId', '=', userId)
          .orderBy('workspaceMember.createdAt')
          .execute()
      ])
      if (!summary) return null
      return {
        user: { ...summary, emailVerified: row.emailVerified },
        methods: methods.map((method) => ({
          provider: method.providerId,
          createdAt: dateString(method.createdAt) ?? ''
        })),
        authenticator: row.twoFactorEnabled === true,
        passkeyCount: Number(passkeys.count),
        sessions,
        signIns,
        workspaces: workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          role: workspace.role,
          memberCount: Number(workspace.memberCount ?? 0),
          joinedAt: dateString(workspace.createdAt) ?? ''
        }))
      }
    },

    async ban(headers: Headers, actorId: string, userId: string, reason?: string): Promise<void> {
      await requireSafeTarget(actorId, userId, 'ban')
      await auth.banUser(headers, userId, reason)
      await audit(actorId, 'user.banned', userId, reason ? { reason } : {})
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
    },

    /**
     * Removes an account's authenticator app, recovery codes, and passkeys, for someone who lost
     * them; they sign in with their password or a linked account and set them up again.
     */
    async resetTwoStep(actorId: string, userId: string): Promise<void> {
      refuseSelf(actorId, userId, 'reset two-step sign-in for')
      const user = await database.transaction().execute(async (transaction) => {
        const target = await transaction
          .selectFrom('user')
          .select(['id', 'email', 'name'])
          .where('id', '=', userId)
          .forUpdate()
          .executeTakeFirstOrThrow()
        await transaction.deleteFrom('twoFactor').where('userId', '=', userId).execute()
        await transaction.deleteFrom('passkey').where('userId', '=', userId).execute()
        await transaction.deleteFrom('mfaAssurance').where('userId', '=', userId).execute()
        await transaction
          .updateTable('user')
          .set({ twoFactorEnabled: false, updatedAt: new Date() })
          .where('id', '=', userId)
          .execute()
        await transaction
          .insertInto('adminAuditEvent')
          .values({
            id: crypto.randomUUID(),
            actorUserId: actorId,
            action: 'user.two-step-reset',
            subjectType: 'user',
            subjectId: userId,
            metadata: {}
          })
          .execute()
        return target
      })
      await options.notify?.sendTwoStepChanged({
        email: user.email,
        name: user.name,
        userId: user.id,
        change: 'reset-by-administrator'
      })
    }
  }
}

export type AdminUserService = ReturnType<typeof createAdminUserService>
