import {
  CLOUD_OAUTH_AUTHORIZE_PAGE,
  CLOUD_TOKEN_SCOPES,
  type CloudAppConnection,
  type CloudOAuthDecision,
  type CloudOAuthRequest,
  type CloudTokenScope
} from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider'
import { compact, uniq } from 'es-toolkit'
import type { Kysely } from 'kysely'

import type { WorkspaceChoices } from './choices'

const isTokenScope = (scope: string): scope is CloudTokenScope =>
  CLOUD_TOKEN_SCOPES.some((each) => each === scope)

/** Where the OAuth provider sends the browser next. */
export type ProviderRedirect = { url: string }

/** The OAuth provider's steps Cloud's approval routes take, called through Better Auth's API. */
export type OAuthProviderSteps = {
  /**
   * Continues after the workspace was picked (`/oauth2/continue` with `postLogin`). The steps take
   * the person's own request, since the provider authorizes from it.
   */
  continue(request: Request, query: string): Promise<ProviderRedirect>
  /** Accepts or refuses the request (`/oauth2/consent`). */
  consent(request: Request, query: string, accept: boolean): Promise<ProviderRedirect>
}

export class OAuthRequestError extends Error {
  constructor(readonly code: 'invalid_request' | 'workspace_not_found') {
    super(code)
    this.name = 'OAuthRequestError'
  }
}

/**
 * The approval page's server side, and the account's list of connected apps. A person signed in
 * with a session that may use the server reaches these; the routes check that first.
 */
export function createOAuthService(options: {
  database: Kysely<CloudDatabase>
  publicURL: string
  secret: string
  choices: WorkspaceChoices
  steps: OAuthProviderSteps
}) {
  const { database, choices, steps } = options

  /** The request a signed query stands for, once its signature and age check out. */
  async function readQuery(query: string): Promise<URLSearchParams> {
    if (!(await verifyOAuthQueryParams(query, options.secret))) {
      throw new OAuthRequestError('invalid_request')
    }
    return new URLSearchParams(query)
  }

  const client = (clientId: string) =>
    database
      .selectFrom('oauthClient')
      .select(['clientId', 'name', 'uri', 'icon', 'disabled'])
      .where('clientId', '=', clientId)
      .executeTakeFirst()

  const appOf = (row: {
    clientId: string
    name: string | null
    uri: string | null
    icon: string | null
  }) => ({
    clientId: row.clientId,
    name: row.name ?? row.clientId,
    uri: row.uri,
    icon: row.icon
  })

  return {
    /** What the approval page shows for a signed request: the app, its scopes, and workspaces. */
    async request(userId: string, query: string): Promise<CloudOAuthRequest> {
      const params = await readQuery(query)
      const app = await client(params.get('client_id') ?? '')
      if (!app || app.disabled) throw new OAuthRequestError('invalid_request')
      const requested = compact((params.get('scope') ?? '').split(' '))
      const workspaces = await database
        .selectFrom('workspaceMember')
        .innerJoin('workspace', 'workspace.id', 'workspaceMember.workspaceId')
        .select(['workspace.id', 'workspace.name'])
        .where('workspaceMember.userId', '=', userId)
        .orderBy('workspace.name')
        .execute()
      return {
        app: appOf(app),
        scopes: requested.filter(isTokenScope),
        offline: requested.includes('offline_access'),
        workspaces
      }
    },

    /**
     * The person's answer: allowing records the workspace, lets the provider continue, and, when
     * it asks for consent next, gives the consent the person just did; refusing ends the request.
     * Either way the answer is where the browser goes next.
     */
    async decide(
      request: Request,
      session: { id: string; userId: string },
      decision: CloudOAuthDecision
    ): Promise<string> {
      await readQuery(decision.query)
      if (decision.decision === 'deny') {
        return (await steps.consent(request, decision.query, false)).url
      }
      if (!(await choices.choose(session.id, session.userId, decision.workspaceId))) {
        throw new OAuthRequestError('workspace_not_found')
      }
      try {
        const next = (await steps.continue(request, decision.query)).url
        const url = new URL(next, options.publicURL)
        // The provider asks for consent on the page the person just approved on.
        if (
          url.origin === new URL(options.publicURL).origin &&
          url.pathname === CLOUD_OAUTH_AUTHORIZE_PAGE
        ) {
          return (await steps.consent(request, url.search.slice(1), true)).url
        }
        return next
      } finally {
        // Each request asks again which workspace, so an app is never handed one unseen.
        await choices.clear(session.id)
      }
    },

    /** The apps the account connected, each with the workspace its grant reaches. */
    async connections(userId: string): Promise<CloudAppConnection[]> {
      const rows = await database
        .selectFrom('oauthConsent')
        .innerJoin('oauthClient', 'oauthClient.clientId', 'oauthConsent.clientId')
        .select([
          'oauthConsent.id',
          'oauthConsent.referenceId',
          'oauthConsent.scopes',
          'oauthConsent.createdAt',
          'oauthClient.clientId',
          'oauthClient.name',
          'oauthClient.uri',
          'oauthClient.icon'
        ])
        .where('oauthConsent.userId', '=', userId)
        .orderBy('oauthConsent.createdAt', 'desc')
        .execute()
      // The provider keeps the workspace as text, so workspaces are read by those IDs.
      const workspaceIds = uniq(compact(rows.map((row) => row.referenceId)))
      const workspaces = workspaceIds.length
        ? await database
            .selectFrom('workspace')
            .select(['id', 'name'])
            .where('id', 'in', workspaceIds)
            .execute()
        : []
      const names = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]))
      return rows.flatMap((row) => {
        const name = row.referenceId ? names.get(row.referenceId) : undefined
        if (!row.referenceId || name === undefined) return []
        return [
          {
            id: row.id,
            app: appOf(row),
            workspace: { id: row.referenceId, name },
            scopes: row.scopes.filter(isTokenScope),
            connectedAt: new Date(row.createdAt).toISOString()
          }
        ]
      })
    },

    /**
     * Disconnects an app from a workspace: its consent goes, so connecting again asks again, and
     * every token of the grant is revoked at once.
     */
    async revoke(userId: string, connectionId: string): Promise<boolean> {
      return database.transaction().execute(async (transaction) => {
        const consent = await transaction
          .deleteFrom('oauthConsent')
          .where('id', '=', connectionId)
          .where('userId', '=', userId)
          .returning(['clientId', 'referenceId'])
          .executeTakeFirst()
        if (!consent) return false
        const revoked = new Date()
        for (const table of ['oauthAccessToken', 'oauthRefreshToken'] as const) {
          await transaction
            .updateTable(table)
            .set({ revoked })
            .where('clientId', '=', consent.clientId)
            .where('userId', '=', userId)
            .where('referenceId', consent.referenceId === null ? 'is' : '=', consent.referenceId)
            .where('revoked', 'is', null)
            .execute()
        }
        return true
      })
    }
  }
}

export type OAuthService = ReturnType<typeof createOAuthService>
