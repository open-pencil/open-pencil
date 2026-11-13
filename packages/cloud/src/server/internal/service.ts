import type { CloudDatabase } from '#cloud/server/db'
import { createAccountEntitlementRepository } from '#cloud/server/policy'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import { setAccountEntitlementsSchema } from './schema'

export type SetAccountEntitlementsInput = v.InferInput<typeof setAccountEntitlementsSchema>

export function parseSetAccountEntitlements(input: unknown) {
  return v.parse(setAccountEntitlementsSchema, input)
}

/**
 * What services beside Cloud, such as billing, may change. Runtimes expose it to them through
 * their own transport: an authenticated HTTP route on Node, a service binding on Workers.
 */
export function createInternalService(database: Kysely<CloudDatabase>) {
  const entitlements = createAccountEntitlementRepository(database)
  return {
    /**
     * Sets an account's plan, which every workspace it owns takes. `found` is false for an
     * unknown account; `applied` is false for an outdated version.
     */
    async setAccountEntitlements(
      userId: string,
      input: SetAccountEntitlementsInput
    ): Promise<{ found: boolean; applied: boolean }> {
      const { values, source, externalVersion } = parseSetAccountEntitlements(input)
      const account = await entitlements.account(userId)
      if (!account) return { found: false, applied: false }
      const { applied } = await entitlements.setVersioned(account, values, source, externalVersion)
      return { found: true, applied }
    }
  }
}

export type InternalService = ReturnType<typeof createInternalService>
