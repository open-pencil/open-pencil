import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

/**
 * An account's seats: the people who can edit in the workspaces it owns, each counted once
 * however many of them they edit, the owner too. Viewers take no seat.
 */
export async function accountSeats(database: Kysely<CloudDatabase>, accountId: string) {
  const row = await database
    .selectFrom('workspaceMember')
    .innerJoin('workspace', 'workspace.id', 'workspaceMember.workspaceId')
    .select((eb) => eb.fn.count<string>('workspaceMember.userId').distinct().as('seats'))
    .where('workspace.ownerId', '=', accountId)
    .where('workspaceMember.role', 'in', ['editor', 'admin'])
    .executeTakeFirst()
  return Number(row?.seats ?? 0)
}
