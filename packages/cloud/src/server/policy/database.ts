import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { EntitlementSource, EntitlementSubject } from './entitlements'
import {
  staticEntitlementValues,
  staticEntitlementsSchema,
  type StaticEntitlements
} from './static'

export class DatabaseEntitlementSource implements EntitlementSource {
  constructor(private readonly database: Kysely<CloudDatabase>) {}

  private async values(subject: EntitlementSubject): Promise<Record<string, boolean | number>> {
    if (subject.type !== 'workspace') return {}
    const row = await this.database
      .selectFrom('workspaceEntitlement')
      .select('values')
      .where('workspaceId', '=', subject.id)
      .executeTakeFirst()
    return row ? staticEntitlementValues(v.parse(staticEntitlementsSchema, row.values)) : {}
  }

  async boolean(subject: EntitlementSubject, key: string): Promise<boolean | null> {
    const value = (await this.values(subject))[key]
    return typeof value === 'boolean' ? value : null
  }

  async number(subject: EntitlementSubject, key: string): Promise<number | null> {
    const value = (await this.values(subject))[key]
    return typeof value === 'number' ? value : null
  }

  async string(_subject: EntitlementSubject, _key: string): Promise<string | null> {
    return null
  }
}

export function createWorkspaceEntitlementRepository(database: Kysely<CloudDatabase>) {
  return {
    async get(workspaceId: string) {
      return database
        .selectFrom('workspaceEntitlement')
        .selectAll()
        .where('workspaceId', '=', workspaceId)
        .executeTakeFirst()
    },

    async set(workspaceId: string, values: StaticEntitlements, source: string) {
      const validated = v.parse(staticEntitlementsSchema, values)
      return database
        .insertInto('workspaceEntitlement')
        .values({ workspaceId, values: validated, source })
        .onConflict((conflict) =>
          conflict.column('workspaceId').doUpdateSet({
            values: validated,
            source,
            revision: (expression) => expression('workspaceEntitlement.revision', '+', 1),
            updatedAt: new Date()
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow()
    },

    async clear(workspaceId: string): Promise<void> {
      await database
        .deleteFrom('workspaceEntitlement')
        .where('workspaceId', '=', workspaceId)
        .execute()
    }
  }
}
