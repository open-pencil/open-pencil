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

  const fresh = () => new Date(Date.now() - WORKSPACE_CHOICE_SECONDS * 1000)

  return {
    /**
     * Records the pick for one request. A session answers one request at a time: while another
     * request's pick is fresh, this one is refused rather than handing that request its workspace.
     */
    async choose(
      sessionId: string,
      userId: string,
      workspaceId: string
    ): Promise<WorkspaceChoice | 'not-member' | 'in-progress'> {
      if (!(await membership(userId, workspaceId))) return 'not-member'
      const chosenAt = new Date()
      const recorded = await database
        .insertInto('oauthWorkspaceChoice')
        .values({ sessionId, userId, workspaceId, chosenAt })
        .onConflict((conflict) =>
          conflict
            .column('sessionId')
            .doUpdateSet({ userId, workspaceId, chosenAt })
            .where('oauthWorkspaceChoice.chosenAt', '<=', fresh())
        )
        .returning('sessionId')
        .executeTakeFirst()
      return recorded ? { sessionId, chosenAt } : 'in-progress'
    },
    /** Forgets a pick once the request it was for is answered. */
    async clear(choice: WorkspaceChoice): Promise<void> {
      await database
        .deleteFrom('oauthWorkspaceChoice')
        .where('sessionId', '=', choice.sessionId)
        .where('chosenAt', '=', choice.chosenAt)
        .execute()
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
        .where('oauthWorkspaceChoice.chosenAt', '>', fresh())
        .executeTakeFirst()
      return choice?.workspaceId
    }
  }
}

/** A pick recorded for one request, which that request alone clears. */
export type WorkspaceChoice = { sessionId: string; chosenAt: Date }

export type WorkspaceChoices = ReturnType<typeof createWorkspaceChoices>
