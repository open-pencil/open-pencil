import { createEnrollmentService, type EnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { admin, bearer, captcha, deviceAuthorization, haveIBeenPwned } from 'better-auth/plugins'
import { importPKCS8, SignJWT } from 'jose'
import type { Kysely } from 'kysely'

import type { CloudAuthAdapter } from './adapter'
import type { AuthenticationEmailService } from './email'

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

export type CloudAuthRuntimeOptions = {
  email?: AuthenticationEmailService
  runInBackground?: (promise: Promise<unknown>) => void
}

export function createBetterAuthAdapter(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  enrollment: EnrollmentService = createEnrollmentService(database),
  runtime: CloudAuthRuntimeOptions = {}
): CloudAuthAdapter {
  const authenticationEmail = runtime.email
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
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        trustedProviders: ['google', 'apple'],
        allowDifferentEmails: false,
        allowUnlinkingAll: false
      }
    },
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: {
        ipAddressHeaders: config.authTrustedIPHeaders,
        trustedProxies: config.authTrustedProxies
      },
      ...(runtime.runInBackground ? { backgroundTasks: { handler: runtime.runInBackground } } : {})
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
        '/device/deny': { window: 60, max: 10 },
        '/sign-in/email': { window: 10, max: 3 },
        '/sign-up/email': { window: 10, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 }
      }
    },
    emailAndPassword: config.emailPasswordEnabled
      ? {
          enabled: true,
          disableSignUp: !config.emailPasswordSignUpEnabled,
          requireEmailVerification: true,
          minPasswordLength: config.emailPasswordMinimumLength,
          maxPasswordLength: config.emailPasswordMaximumLength,
          autoSignIn: false,
          resetPasswordTokenExpiresIn: config.passwordResetExpiresIn,
          revokeSessionsOnPasswordReset: true,
          sendResetPassword: authenticationEmail
            ? ({ user, url, token }) =>
                authenticationEmail.sendPasswordReset({
                  email: user.email,
                  name: user.name,
                  url,
                  token
                })
            : undefined,
          onPasswordReset: authenticationEmail
            ? ({ user }) =>
                authenticationEmail.sendPasswordChanged({
                  email: user.email,
                  name: user.name,
                  userId: user.id,
                  url: config.publicURL
                })
            : undefined
        }
      : undefined,
    emailVerification:
      config.emailPasswordEnabled && authenticationEmail
        ? {
            expiresIn: config.emailVerificationExpiresIn,
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: ({ user, url, token }) =>
              authenticationEmail.sendVerification({
                email: user.email,
                name: user.name,
                url,
                token
              }),
            afterEmailVerification: async (user) => {
              if (config.enrollmentMode === 'approval') {
                await enrollment.request({ email: user.email, name: user.name })
              }
              await enrollment.bindApprovedUser(user.email, user.id)
            }
          }
        : undefined,
    user: {
      validateUserInfo: ({ source }) => {
        if (source.action === 'create-user' && config.enrollmentMode === 'closed') {
          return { error: 'enrollment_closed', errorDescription: 'Cloud enrollment is closed' }
        }
        return undefined
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (!user.emailVerified) return
            if (config.enrollmentMode === 'approval') {
              await enrollment.request({ email: user.email, name: user.name })
            }
            await enrollment.bindApprovedUser(user.email, user.id)
          }
        }
      }
    },
    plugins: [
      ...(config.captchaProvider && config.captchaSecretKey
        ? [
            captcha({
              provider: config.captchaProvider,
              secretKey: config.captchaSecretKey,
              allowedHostnames: config.captchaAllowedHostnames,
              endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset']
            })
          ]
        : []),
      ...(config.compromisedPasswordCheck ? [haveIBeenPwned()] : []),
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

  const resolveIdentity = async (headers: Headers) => {
    const session = await auth.api.getSession({ headers })
    if (!session) return null
    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      deploymentRole:
        'role' in session.user && session.user.role === 'admin'
          ? ('admin' as const)
          : ('user' as const)
    }
  }

  return {
    handler: auth.handler,
    resolveIdentity,
    async resolveSession(headers) {
      const identity = await resolveIdentity(headers)
      if (!identity) return null
      if (config.enrollmentMode === 'approval' && !(await enrollment.isApproved(identity.email))) {
        return null
      }
      return identity
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
