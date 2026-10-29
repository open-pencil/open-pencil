import {
  containsPattern,
  countEachFilter,
  listSearch,
  listWindow,
  type AdminListQuery,
  type ListFilters
} from '#cloud/admin/list'
import { isUUID } from '#cloud/admin/schema'
import { cloudAdminAuditFilterSchema, type CloudAdminAuditFilter } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { uniq } from 'es-toolkit'
import type { ExpressionBuilder, Kysely } from 'kysely'

/** Events by what they are about; every event is under `all`. */
const FILTERS: ListFilters<CloudAdminAuditFilter, 'adminAuditEvent'> = {
  all: (expression) => expression.lit(true),
  accounts: (expression) => expression('adminAuditEvent.subjectType', '=', 'user'),
  requests: (expression) => expression('adminAuditEvent.subjectType', '=', 'enrollment'),
  email: (expression) => expression('adminAuditEvent.subjectType', '=', 'transactional-email')
}

type AuditExpression = ExpressionBuilder<CloudDatabase, 'adminAuditEvent'>

/** Events whose actor, or the account or request they are about, has `pattern` in a name or email. */
function searchCondition(pattern: string) {
  return (expression: AuditExpression) => {
    const account = (column: 'adminAuditEvent.actorUserId' | 'adminAuditEvent.subjectId') =>
      expression.exists(
        expression
          .selectFrom('user')
          .select('user.id')
          .where((inner) => inner(inner.cast('user.id', 'text'), '=', inner.ref(column)))
          .where((inner) =>
            inner.or([inner('user.name', 'ilike', pattern), inner('user.email', 'ilike', pattern)])
          )
      )
    return expression.or([
      account('adminAuditEvent.actorUserId'),
      expression.and([
        expression('adminAuditEvent.subjectType', '=', 'user'),
        account('adminAuditEvent.subjectId')
      ]),
      expression.and([
        expression('adminAuditEvent.subjectType', '=', 'enrollment'),
        expression.exists(
          expression
            .selectFrom('enrollment')
            .select('enrollment.id')
            .where((inner) =>
              inner(
                inner.cast('enrollment.id', 'text'),
                '=',
                inner.ref('adminAuditEvent.subjectId')
              )
            )
            .where((inner) =>
              inner.or([
                inner('enrollment.name', 'ilike', pattern),
                inner('enrollment.emailNormalized', 'ilike', pattern)
              ])
            )
        )
      ])
    ])
  }
}

export function createAdminAuditService(database: Kysely<CloudDatabase>) {
  return {
    /**
     * A page of events, newest first, each with its actor's and subject's names while the server
     * knows them, and how many match the search under each filter.
     */
    async list(query: AdminListQuery<CloudAdminAuditFilter> = {}) {
      const search = listSearch(query)
      const filter = query.filter ?? 'all'
      const { limit, offset } = listWindow(query)
      let searched = database.selectFrom('adminAuditEvent')
      if (search) searched = searched.where(searchCondition(containsPattern(search)))
      const counts = await countEachFilter(searched, cloudAdminAuditFilterSchema.options, FILTERS)
      const events = await searched
        .where(FILTERS[filter])
        .selectAll()
        .orderBy('createdAt', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
        .offset(offset)
        .execute()
      // Accounts and requests are named by UUID; anything else is not looked up.
      const userIds = uniq(
        events.flatMap((event) =>
          event.subjectType === 'user' ? [event.actorUserId, event.subjectId] : [event.actorUserId]
        )
      ).filter(isUUID)
      const enrollmentIds = uniq(
        events.flatMap((event) => (event.subjectType === 'enrollment' ? [event.subjectId] : []))
      ).filter(isUUID)
      const [users, enrollments] = await Promise.all([
        userIds.length
          ? database.selectFrom('user').select(['id', 'name']).where('id', 'in', userIds).execute()
          : [],
        enrollmentIds.length
          ? database
              .selectFrom('enrollment')
              .select(['id', 'name', 'emailNormalized'])
              .where('id', 'in', enrollmentIds)
              .execute()
          : []
      ])
      const names = new Map(users.map((user) => [user.id, user.name]))
      const requesters = new Map(
        enrollments.map((enrollment) => [
          enrollment.id,
          enrollment.name ?? enrollment.emailNormalized
        ])
      )
      const rows = events.map((event) => ({
        id: event.id,
        actor: { id: event.actorUserId, name: names.get(event.actorUserId) ?? null },
        action: event.action,
        subject: {
          type: event.subjectType,
          id: event.subjectId,
          name:
            (event.subjectType === 'enrollment'
              ? requesters.get(event.subjectId)
              : names.get(event.subjectId)) ?? null
        },
        metadata: event.metadata,
        createdAt: event.createdAt
      }))
      return { events: rows, total: counts[filter], counts }
    }
  }
}

export type AdminAuditService = ReturnType<typeof createAdminAuditService>
