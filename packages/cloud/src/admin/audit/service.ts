import { ADMIN_LIST_MAXIMUM } from '#cloud/admin/schema'
import type { CloudDatabase } from '#cloud/server/db'
import { clamp, uniq } from 'es-toolkit'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

const uuidSchema = v.pipe(v.string(), v.uuid())
const isUUID = (value: string) => v.is(uuidSchema, value)

export function createAdminAuditService(database: Kysely<CloudDatabase>) {
  return {
    /** The newest events, each with its actor's and subject's names while the server knows them. */
    async list(limit = 100) {
      const events = await database
        .selectFrom('adminAuditEvent')
        .selectAll()
        .orderBy('createdAt', 'desc')
        .limit(clamp(limit, 1, ADMIN_LIST_MAXIMUM))
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
      return events.map((event) => ({
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
    }
  }
}

export type AdminAuditService = ReturnType<typeof createAdminAuditService>
