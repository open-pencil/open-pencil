import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import type { EntitlementSource, EntitlementSubject } from './entitlements'
import { staticEntitlementsSchema } from './schema'
import { staticEntitlementValues, type StaticEntitlementsInput } from './static'

export class DatabaseEntitlementSource implements EntitlementSource {
  constructor(private readonly database: Kysely<CloudDatabase>) {}

  private async values(subject: EntitlementSubject): Promise<Record<string, boolean | number>> {
    if (subject.type !== 'user') return {}
    const row = await this.database
      .selectFrom('accountEntitlement')
      .select('values')
      .where('userId', '=', subject.id)
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

/** Each account's stored entitlements, which every workspace it owns takes. */
const accountIdSchema = v.pipe(v.string(), v.uuid())

export function createAccountEntitlementRepository(database: Kysely<CloudDatabase>) {
  return {
    /**
     * The account `userId` names, as the user table spells it, or null when there is none, so a
     * plan is stored under the key policy reads, whatever case the caller wrote the ID in.
     */
    async account(userId: string): Promise<string | null> {
      if (!v.is(accountIdSchema, userId)) return null
      const user = await database
        .selectFrom('user')
        .select('id')
        .where('id', '=', userId)
        .executeTakeFirst()
      return user?.id ?? null
    },

    async get(userId: string) {
      return database
        .selectFrom('accountEntitlement')
        .selectAll()
        .where('userId', '=', userId)
        .executeTakeFirst()
    },

    async set(userId: string, values: StaticEntitlementsInput, source: string) {
      const validated = v.parse(staticEntitlementsSchema, values)
      return database
        .insertInto('accountEntitlement')
        .values({ userId, values: validated, source })
        .onConflict((conflict) =>
          conflict.column('userId').doUpdateSet({
            values: validated,
            source,
            revision: (expression) => expression('accountEntitlement.revision', '+', 1),
            updatedAt: new Date()
          })
        )
        .returningAll()
        .executeTakeFirstOrThrow()
    },

    /**
     * Stores entitlements an external writer versioned, unless the stored row carries a newer
     * version: billing events arrive out of order, and a late one must not undo a newer plan.
     * An unversioned row, such as one an operator set, is replaced.
     */
    async setVersioned(
      userId: string,
      values: StaticEntitlementsInput,
      source: string,
      externalVersion: number
    ): Promise<{ applied: boolean }> {
      const validated = v.parse(staticEntitlementsSchema, values)
      const row = await database
        .insertInto('accountEntitlement')
        .values({ userId, values: validated, source, externalVersion })
        .onConflict((conflict) =>
          conflict
            .column('userId')
            .doUpdateSet({
              values: validated,
              source,
              externalVersion,
              revision: (expression) => expression('accountEntitlement.revision', '+', 1),
              updatedAt: new Date()
            })
            .where((expression) =>
              expression.or([
                expression('accountEntitlement.externalVersion', 'is', null),
                expression('accountEntitlement.externalVersion', '<', externalVersion)
              ])
            )
        )
        .returning('userId')
        .executeTakeFirst()
      return { applied: row !== undefined }
    },

    async clear(userId: string): Promise<void> {
      await database.deleteFrom('accountEntitlement').where('userId', '=', userId).execute()
    }
  }
}
