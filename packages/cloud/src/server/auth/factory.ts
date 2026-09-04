import { createEnrollmentService, type EnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { passkey } from '@better-auth/passkey'
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import {
  admin,
  bearer,
  captcha,
  deviceAuthorization,
  haveIBeenPwned,
  twoFactor
} from 'better-auth/plugins'
import { importPKCS8, SignJWT } from 'jose'
import type { Kysely } from 'kysely'

import type { CloudAuthAdapter } from './adapter'
import type { AuthenticationEmailService } from './email'
import { createMFAAssuranceService } from './mfa-assurance'

const APPLE_AUDIENCE = 'https://appleid.apple.com'
const APPLE_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60
const BETTER_AUTH_SCHEMA_VERSION = '1.7.2+mfa.1'
const ACCOUNT_SECURITY_FRESH_AGE_SECONDS = 10 * 60

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

function assuranceMethod(path: string): 'totp' | 'recovery-code' | 'passkey' | null {
  if (path === '/api/auth/two-factor/verify-totp') return 'totp'
  if (path === '/api/auth/two-factor/verify-backup-code') return 'recovery-code'
  if (path === '/api/auth/passkey/verify-authentication') return 'passkey'
  return null
}

async function recordResponseAssurance(
  response: Response,
  method: 'totp' | 'recovery-code' | 'passkey',
  database: Kysely<CloudDatabase>,
  assurance: ReturnType<typeof createMFAAssuranceService>
): Promise<void> {
  const signedToken = response.headers.get('set-auth-token')
  const token = signedToken?.split('.', 1)[0]
  if (!token) return
  const session = await database
    .selectFrom('session')
    .select(['id', 'userId'])
    .where('token', '=', token)
    .executeTakeFirst()
  if (session) await assurance.record({ sessionId: session.id, userId: session.userId, method })
}

async function verifySecondFactor(
  auth: { handler(request: Request): Promise<Response> },
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  assurance: ReturnType<typeof createMFAAssuranceService>,
  headers: Headers,
  code: string,
  method: 'totp' | 'recovery-code'
): Promise<Response> {
  const path = method === 'totp' ? 'verify-totp' : 'verify-backup-code'
  const response = await auth.handler(
    new Request(new URL(`/api/auth/two-factor/${path}`, config.publicURL), {
      method: 'POST',
      headers: new Headers({
        ...Object.fromEntries(headers),
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ code, trustDevice: false })
    })
  )
  if (!response.ok) throw APIError.fromStatus(response.status as 401)
  await recordResponseAssurance(response, method, database, assurance)
  return response
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
  const assurance = createMFAAssuranceService(database, config)
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
        allowUnlinkingAll: false,
        requireLocalEmailVerified: true
      }
    },
    session: { freshAge: ACCOUNT_SECURITY_FRESH_AGE_SECONDS },
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
      twoFactor({
        issuer: 'OpenPencil Cloud',
        trustDeviceMaxAge: config.mfaTrustedDeviceDays * 24 * 60 * 60,
        allowPasswordless: true,
        totpOptions: { disable: !config.totpEnabled, allowPasswordless: true },
        backupCodeOptions: {
          disable: !config.totpEnabled || !config.recoveryCodesEnabled,
          storeBackupCodes: 'encrypted'
        }
      }),
      passkey({
        rpID: config.passkeyRPID ?? new URL(config.publicURL).hostname,
        rpName: config.passkeyRPName,
        origin: config.passkeyOrigin ?? new URL(config.publicURL).origin
      }),
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
    handler: async (request) => {
      const response = await auth.handler(request)
      const method = assuranceMethod(new URL(request.url).pathname)
      if (response.ok && method)
        await recordResponseAssurance(response, method, database, assurance)
      return response
    },
    resolveIdentity,
    async resolveSession(headers) {
      const identity = await resolveIdentity(headers)
      if (!identity) return null
      if (config.enrollmentMode === 'approval' && !(await enrollment.isApproved(identity.email))) {
        return null
      }
      return identity
    },
    async listAuthenticationMethods(headers) {
      const accounts = await auth.api.listUserAccounts({ headers })
      return accounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        createdAt: account.createdAt
      }))
    },
    async changePassword(headers, input) {
      const session = authenticationEmail ? await auth.api.getSession({ headers }) : null
      await auth.api.changePassword({
        headers,
        body: { ...input, revokeOtherSessions: false }
      })
      await auth.api.revokeOtherSessions({ headers })
      if (authenticationEmail && session) {
        await authenticationEmail.sendPasswordChanged({
          email: session.user.email,
          name: session.user.name,
          userId: session.user.id,
          url: config.publicURL
        })
      }
    },
    async startSocialLink(headers, input) {
      const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } })
      const createdAt = session?.session.createdAt
      if (
        !createdAt ||
        Date.now() - new Date(createdAt).getTime() >= ACCOUNT_SECURITY_FRESH_AGE_SECONDS * 1000
      ) {
        throw APIError.from('FORBIDDEN', {
          code: 'SESSION_NOT_FRESH',
          message: 'Session is not fresh'
        })
      }
      const response = await auth.api.linkSocialAccount({
        headers,
        body: {
          provider: input.provider,
          callbackURL: input.callbackURL,
          errorCallbackURL: input.callbackURL,
          disableRedirect: true
        }
      })
      return response.url
    },
    async unlinkAuthenticationMethod(headers, methodId) {
      await auth.api.unlinkAccount({ headers, body: { accountId: methodId } })
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
    async mfaStatus(headers) {
      const session = await auth.api.getSession({ headers, query: { disableCookieCache: true } })
      if (!session) return null
      const passkeys = await auth.api.listPasskeys({ headers })
      return assurance.status({
        sessionId: session.session.id,
        userId: session.user.id,
        deploymentRole: 'role' in session.user && session.user.role === 'admin' ? 'admin' : 'user',
        twoFactorEnabled:
          'twoFactorEnabled' in session.user && session.user.twoFactorEnabled === true,
        passkeyCount: passkeys.length
      })
    },
    async enableTOTP(headers, password) {
      const response = await auth.api.enableTwoFactor({
        headers,
        body: { password, method: 'totp' }
      })
      if (response.method !== 'totp') throw new Error('TOTP setup was unavailable')
      return { totpURI: response.totpURI, backupCodes: response.backupCodes }
    },
    async verifyTOTP(headers, code) {
      return verifySecondFactor(auth, config, database, assurance, headers, code, 'totp')
    },
    async verifyRecoveryCode(headers, code) {
      return verifySecondFactor(auth, config, database, assurance, headers, code, 'recovery-code')
    },
    async generateRecoveryCodes(headers, password) {
      return (await auth.api.generateBackupCodes({ headers, body: { password } })).backupCodes
    },
    async disableTOTP(headers, password) {
      await auth.api.disableTwoFactor({ headers, body: { password } })
    },
    async listPasskeys(headers) {
      return (await auth.api.listPasskeys({ headers })).map((item) => ({
        id: item.id,
        name: item.name,
        createdAt: item.createdAt
      }))
    },
    async deletePasskey(headers, id) {
      await auth.api.deletePasskey({ headers, body: { id } })
    },
    schemaVersion: BETTER_AUTH_SCHEMA_VERSION,
    async migrate() {
      const migrations = await getMigrations(auth.options)
      await migrations.runMigrations()
    }
  }
}
