import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

/**
 * How long a workspace a person picked on the approval page counts, at most: the life of the
 * signed request the page was sent. A pick is forgotten as soon as its request is answered.
 */
export const WORKSPACE_CHOICE_SECONDS = 10 * 60

/**
 * The workspace a person picked, per session, for the app they are connecting: the approval page
 * records it, and the OAuth provider reads it back as the grant's `referenceId`, which every
 * token the grant issues carries. Only a workspace the person still belongs to counts.
 */
export function createWorkspaceChoices(database: Kysely<CloudDatabase>) {
  const membership = (userId: string, workspaceId: string) =>
    database
      .selectFrom('workspaceMember')
      .select('workspaceId')
      .where('userId', '=', userId)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst()

  return {
    /** Records the pick, or answers false when the person is not in that workspace. */
    async choose(sessionId: string, userId: string, workspaceId: string): Promise<boolean> {
      if (!(await membership(userId, workspaceId))) return false
      await database
        .insertInto('oauthWorkspaceChoice')
        .values({ sessionId, userId, workspaceId, chosenAt: new Date() })
        .onConflict((conflict) =>
          conflict.column('sessionId').doUpdateSet({ userId, workspaceId, chosenAt: new Date() })
        )
        .execute()
      return true
    },
    /** Forgets the session's pick once the request it was for is answered. */
    async clear(sessionId: string): Promise<void> {
      await database.deleteFrom('oauthWorkspaceChoice').where('sessionId', '=', sessionId).execute()
    },
    /** The session's recent pick, while its person still belongs to the workspace. */
    async current(sessionId: string, userId: string): Promise<string | undefined> {
      const choice = await database
        .selectFrom('oauthWorkspaceChoice')
        .innerJoin('workspaceMember', (join) =>
          join
            .onRef('workspaceMember.workspaceId', '=', 'oauthWorkspaceChoice.workspaceId')
            .onRef('workspaceMember.userId', '=', 'oauthWorkspaceChoice.userId')
        )
        .select('oauthWorkspaceChoice.workspaceId')
        .where('oauthWorkspaceChoice.sessionId', '=', sessionId)
        .where('oauthWorkspaceChoice.userId', '=', userId)
        .where(
          'oauthWorkspaceChoice.chosenAt',
          '>',
          new Date(Date.now() - WORKSPACE_CHOICE_SECONDS * 1000)
        )
        .executeTakeFirst()
      return choice?.workspaceId
    }
  }
}

export type WorkspaceChoices = ReturnType<typeof createWorkspaceChoices>
