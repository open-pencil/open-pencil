import { createEnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { admin, bearer, deviceAuthorization } from 'better-auth/plugins'
import { importPKCS8, SignJWT } from 'jose'
import type { Kysely } from 'kysely'

import type { CloudAuthAdapter } from './adapter'

const APPLE_AUDIENCE = 'https://appleid.apple.com'
const APPLE_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60
const BETTER_AUTH_SCHEMA_VERSION = '1.7.2'

async function generateAppleClientSecret(config: CloudServerConfig): Promise<string> {
  if (
    !config.appleClientId ||
    !config.appleTeamId ||
    !config.appleKeyId ||
    !config.applePrivateKey
  ) {
    throw new Error('Apple authentication is not configured')
  }
  const privateKey = await importPKCS8(config.applePrivateKey.replaceAll('\\n', '\n'), 'ES256')
  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.appleKeyId })
    .setIssuer(config.appleTeamId)
    .setSubject(config.appleClientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + APPLE_SECRET_LIFETIME_SECONDS)
    .sign(privateKey)
}

function socialProviders(config: CloudServerConfig): BetterAuthOptions['socialProviders'] {
  const providers: BetterAuthOptions['socialProviders'] = {}
  if (config.googleClientId && config.googleClientSecret) {
    providers.google = {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret
    }
  }
  if (config.appleClientId) {
    providers.apple = async () => {
      const provider: {
        clientId: string
        clientSecret: string
        appBundleIdentifier?: string
      } = {
        clientId: config.appleClientId ?? '',
        clientSecret: await generateAppleClientSecret(config)
      }
      if (config.appleAppBundleIdentifier) {
        provider.appBundleIdentifier = config.appleAppBundleIdentifier
      }
      return provider
    }
  }
  return providers
}

export function createBetterAuthAdapter(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>
): CloudAuthAdapter {
  const enrollment = createEnrollmentService(database)
  const auth = betterAuth({
    appName: 'OpenPencil Cloud',
    baseURL: config.publicURL,
    basePath: '/api/auth',
    secret: config.authSecret,
    database: {
      db: database,
      type: 'postgres',
      casing: 'camel',
      transaction: true
    },
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: {
        ipAddressHeaders: config.authTrustedIPHeaders,
        trustedProxies: config.authTrustedProxies
      }
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/device/code': { window: 60, max: 10 },
        '/device/token': { window: 60, max: 60 },
        '/device/approve': { window: 60, max: 10 },
        '/device/deny': { window: 60, max: 10 }
      }
    },
    user: {
      validateUserInfo: async ({ user, source }) => {
        if (source.action !== 'create-user') return undefined
        if (config.enrollmentMode === 'closed') {
          return { error: 'enrollment_closed', errorDescription: 'Cloud enrollment is closed' }
        }
        if (
          config.enrollmentMode === 'approval' &&
          (!user.email || !(await enrollment.isApproved(user.email)))
        ) {
          return {
            error: 'enrollment_approval_required',
            errorDescription: 'Cloud enrollment approval is required'
          }
        }
        return undefined
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await enrollment.bindApprovedUser(user.email, user.id)
          }
        }
      }
    },
    plugins: [
      admin(
        config.deploymentAdminUserIds.length > 0
          ? { adminUserIds: config.deploymentAdminUserIds }
          : {}
      ),
      bearer({ requireSignature: true }),
      deviceAuthorization({
        verificationUri: `${config.appURL ?? config.publicURL}/cloud/device`,
        validateClient: (clientId) => clientId.startsWith('openpencil-desktop:')
      })
    ],
    socialProviders: socialProviders(config),
    trustedOrigins: [
      config.publicURL,
      ...config.trustedOrigins,
      ...(config.appleClientId ? [APPLE_AUDIENCE] : [])
    ]
  })

  return {
    handler: auth.handler,
    async resolveSession(headers) {
      const session = await auth.api.getSession({ headers })
      if (!session) return null
      if (
        config.enrollmentMode === 'approval' &&
        !(await enrollment.isApproved(session.user.email))
      ) {
        return null
      }
      return {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        deploymentRole: session.user.role ?? undefined
      }
    },
    async listUsers(headers, query) {
      const listQuery = query?.searchValue
        ? {
            searchValue: query.searchValue,
            searchField: 'email' as const,
            limit: query.limit,
            offset: query.offset
          }
        : { limit: query?.limit, offset: query?.offset }
      const response = await auth.api.listUsers({ headers, query: listQuery })
      return { users: response.users, total: response.total }
    },
    async banUser(headers, userId, reason) {
      await auth.api.banUser({ headers, body: { userId, banReason: reason } })
    },
    async unbanUser(headers, userId) {
      await auth.api.unbanUser({ headers, body: { userId } })
    },
    async revokeUserSessions(headers, userId) {
      await auth.api.revokeUserSessions({ headers, body: { userId } })
    },
    async setRole(headers, userId, role) {
      await auth.api.setRole({ headers, body: { userId, role } })
    },
    schemaVersion: BETTER_AUTH_SCHEMA_VERSION,
    async migrate() {
      const migrations = await getMigrations(auth.options)
      await migrations.runMigrations()
    }
  }
}
