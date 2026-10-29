import type { CloudDatabase } from '#cloud/server/db'
import { createWorkspaceEntitlementRepository } from '#cloud/server/policy'
import type { Kysely } from 'kysely'
import * as v from 'valibot'

import { setWorkspaceEntitlementsSchema } from './schema'

export type SetWorkspaceEntitlementsInput = v.InferInput<typeof setWorkspaceEntitlementsSchema>

export function parseSetWorkspaceEntitlements(input: unknown) {
  return v.parse(setWorkspaceEntitlementsSchema, input)
}

/**
 * What services beside Cloud, such as billing, may change. Runtimes expose it to them through
 * their own transport: an authenticated HTTP route on Node, a service binding on Workers.
 */
export function createInternalService(database: Kysely<CloudDatabase>) {
  const entitlements = createWorkspaceEntitlementRepository(database)
  return {
    /** `found` is false for an unknown workspace; `applied` is false for an outdated version. */
    async setWorkspaceEntitlements(
      workspaceId: string,
      input: SetWorkspaceEntitlementsInput
    ): Promise<{ found: boolean; applied: boolean }> {
      const { values, source, externalVersion } = parseSetWorkspaceEntitlements(input)
      const workspace = await database
        .selectFrom('workspace')
        .select('id')
        .where('id', '=', workspaceId)
        .executeTakeFirst()
      if (!workspace) return { found: false, applied: false }
      const { applied } = await entitlements.setVersioned(
        workspaceId,
        values,
        source,
        externalVersion
      )
      return { found: true, applied }
    }
  }
}

export type InternalService = ReturnType<typeof createInternalService>
