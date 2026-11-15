import type { CloudAccountSession, CloudSignIn, CloudSignInMethod } from '#cloud/contract'
import type { CloudDatabase } from '#cloud/server/db'
import { dateString } from '#cloud/server/sharing/contracts'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import type { Kysely } from 'kysely'

import type { AuthenticationEmailService } from './email'
import { CORE_AUTH_PATHS, isAuthEndpoint } from './endpoints'
import { describeUserAgent } from './user-agent'

/** The newest sign-ins an account's history shows. */
const SIGN_IN_HISTORY_LIMIT = 50

type Endpoint = { path: string }

/** The plugin endpoints that sign someone in, as the server's plugins declare them. */
export type SignInPluginEndpoints = {
  twoStep: { verifyTOTP: Endpoint; verifyBackupCode: Endpoint }
  passkeys: { verifyPasskeyAuthentication: Endpoint; verifyPasskeyRegistration: Endpoint }
  devices: { deviceToken: Endpoint }
}

/** The Better Auth endpoints that sign someone in, and the method each one is. */
export type SignInEndpoints = readonly (readonly [path: string, method: CloudSignInMethod])[]

/** The sign-in endpoints of the core and of the server's plugins, from their own paths. */
export function signInEndpoints(plugins: SignInPluginEndpoints): SignInEndpoints {
  return [
    [CORE_AUTH_PATHS.signInEmail, 'password'],
    [plugins.passkeys.verifyPasskeyAuthentication.path, 'passkey'],
    [plugins.twoStep.verifyTOTP.path, 'two-step'],
    [plugins.twoStep.verifyBackupCode.path, 'two-step'],
    [CORE_AUTH_PATHS.verifyEmail, 'email-link'],
    [plugins.devices.deviceToken.path, 'desktop']
  ]
}

/**
 * How an endpoint signed someone in, or null when it signs nobody in, such as one that refreshes
 * a session. A provider's callback names the provider, as Better Auth's own `lastLoginMethod`
 * reads it.
 */
export function signInMethod(
  endpoint: { path?: string; params?: Record<string, string | undefined> },
  methods: SignInEndpoints
): CloudSignInMethod | null {
  if (isAuthEndpoint(endpoint.path, CORE_AUTH_PATHS.callbackOAuth)) {
    const provider = endpoint.params?.id
    return provider === 'google' || provider === 'apple' ? provider : 'other'
  }
  return methods.find(([path]) => isAuthEndpoint(endpoint.path, path))?.[1] ?? null
}

/**
 * Where an account signs in from. Each new session is written down with how it was made, so the
 * account's owner can read its sign-ins and sessions, and a sign-in from an address the account
 * never used before is told to its email; the first sign-in an account makes is not.
 */
export function createSignInActivity(
  database: Kysely<CloudDatabase>,
  email?: AuthenticationEmailService
) {
  return {
    /** Writes down a session an endpoint just issued, and mails a sign-in from a new address. */
    async record(
      issued: {
        session: {
          id: string
          userId: string
          ipAddress?: string | null
          userAgent?: string | null
        }
        user: { email: string; name: string }
      },
      method: CloudSignInMethod
    ): Promise<void> {
      const { session, user } = issued
      // Confirming a new email address issues the session it was confirmed in again.
      const recorded = await database
        .selectFrom('signIn')
        .select('id')
        .where('sessionId', '=', session.id)
        .executeTakeFirst()
      if (recorded) return
      const ipAddress = session.ipAddress || null
      const [known, earlier] = await Promise.all([
        ipAddress
          ? database
              .selectFrom('signIn')
              .select('id')
              .where('userId', '=', session.userId)
              .where('ipAddress', '=', ipAddress)
              .executeTakeFirst()
          : undefined,
        database
          .selectFrom('signIn')
          .select('id')
          .where('userId', '=', session.userId)
          .executeTakeFirst()
      ])
      const id = crypto.randomUUID()
      const signedInAt = new Date()
      await database
        .insertInto('signIn')
        .values({
          id,
          userId: session.userId,
          sessionId: session.id,
          method,
          ipAddress,
          userAgent: session.userAgent || null,
          createdAt: signedInAt
        })
        .execute()
      if (!email || !earlier || known || !ipAddress) return
      await email.sendNewSignIn({
        email: user.email,
        name: user.name,
        signInId: id,
        signedInAt,
        ipAddress,
        ...describeUserAgent(session.userAgent),
        desktop: method === 'desktop'
      })
    },

    /** The account's sessions that have not expired, newest activity first. */
    async sessions(userId: string, currentSessionId: string): Promise<CloudAccountSession[]> {
      const rows = await database
        .selectFrom('session')
        .leftJoin('signIn', 'signIn.sessionId', 'session.id')
        .select([
          'session.id',
          'session.ipAddress',
          'session.userAgent',
          'session.createdAt',
          'session.updatedAt',
          'session.expiresAt',
          'signIn.method'
        ])
        .where('session.userId', '=', userId)
        .where('session.expiresAt', '>', new Date())
        .orderBy('session.updatedAt', 'desc')
        .execute()
      return rows.map((row) => ({
        id: row.id,
        current: row.id === currentSessionId,
        method: row.method ?? null,
        ipAddress: row.ipAddress || null,
        ...describeUserAgent(row.userAgent),
        createdAt: dateString(row.createdAt) ?? '',
        lastActiveAt: dateString(row.updatedAt) ?? '',
        expiresAt: dateString(row.expiresAt) ?? ''
      }))
    },

    async signIns(userId: string, limit = SIGN_IN_HISTORY_LIMIT): Promise<CloudSignIn[]> {
      const rows = await database
        .selectFrom('signIn')
        .select(['id', 'method', 'ipAddress', 'userAgent', 'createdAt'])
        .where('userId', '=', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .execute()
      return rows.map((row) => ({
        id: row.id,
        method: row.method,
        ipAddress: row.ipAddress,
        ...describeUserAgent(row.userAgent),
        createdAt: dateString(row.createdAt) ?? ''
      }))
    }
  }
}

export type SignInActivity = ReturnType<typeof createSignInActivity>

/**
 * Better Auth's side of account activity. After an endpoint issues a session, Better Auth hands
 * it to hooks as `newSession`; two-step sign-in clears it until the second step, so only
 * sessions someone can use are written down. Adding a passkey is told to its owner.
 */
export function accountActivity(
  activity: SignInActivity,
  plugins: SignInPluginEndpoints,
  onPasskeyAdded: (user: { id: string; email: string; name: string }) => Promise<void>
): BetterAuthPlugin {
  const methods = signInEndpoints(plugins)
  return {
    id: 'openpencil-account-activity',
    hooks: {
      after: [
        {
          matcher: (context) => signInMethod(context, methods) !== null,
          handler: createAuthMiddleware(async (context) => {
            const issued = context.context.newSession
            const method = signInMethod(context, methods)
            if (issued && method) await activity.record(issued, method)
          })
        },
        {
          matcher: (context) =>
            isAuthEndpoint(context.path, plugins.passkeys.verifyPasskeyRegistration.path),
          handler: createAuthMiddleware(async (context) => {
            const user = context.context.session?.user
            if (user && !isAPIError(context.context.returned)) await onPasskeyAdded(user)
          })
        }
      ]
    }
  }
}
