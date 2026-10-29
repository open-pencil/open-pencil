import { createEnrollmentService, type EnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import { createUserPictures, providerPictures } from '#cloud/server/pictures'
import { passkey } from '@better-auth/passkey'
import { APIError, betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import {
  admin,
  bearer,
  captcha,
  deviceAuthorization,
  haveIBeenPwned,
  twoFactor
} from 'better-auth/plugins'
import type { Kysely } from 'kysely'

import { accountActivity, createSignInActivity } from './activity'
import type { CloudAuthAdapter } from './adapter'
import type { AuthenticationEmailService } from './email'
import { AUTH_BASE_PATH, CORE_AUTH_PATHS, authRequestPath } from './endpoints'
import { createMFAAssuranceService } from './mfa-assurance'
import { APPLE_AUDIENCE, socialProviders } from './social-providers'

const BETTER_AUTH_SCHEMA_VERSION = '1.7.7+mfa.1'
const ACCOUNT_SECURITY_FRESH_AGE_SECONDS = 10 * 60

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
  method: 'totp' | 'recovery-code',
  /** The two-step plugin's endpoint that checks this kind of code. */
  endpoint: { path: string }
): Promise<Response> {
  const response = await auth.handler(
    new Request(new URL(authRequestPath(endpoint.path), config.publicURL), {
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
  /**
   * Whether Better Auth checks the database schema when it starts. Runtimes that start it for
   * every request turn this off; `migrateCloudDatabase` has already checked the recorded version.
   */
  validateSchema?: boolean
}

export function createBetterAuthAdapter(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  enrollment: EnrollmentService = createEnrollmentService(database),
  runtime: CloudAuthRuntimeOptions = {}
): CloudAuthAdapter {
  const authenticationEmail = runtime.email
  const assurance = createMFAAssuranceService(database, config)
  const activity = createSignInActivity(database, authenticationEmail)
  // A new address is confirmed through a link sent to it, so changing one needs email delivery.
  const emailChangeAvailable = Boolean(config.emailPasswordEnabled && authenticationEmail)
  // The plugins are built first, so the options below name their endpoints by the paths they declare.
  const twoStep = twoFactor({
    issuer: 'OpenPencil Cloud',
    trustDeviceMaxAge: config.mfaTrustedDeviceDays * 24 * 60 * 60,
    allowPasswordless: true,
    totpOptions: { disable: !config.totpEnabled, allowPasswordless: true },
    backupCodeOptions: {
      disable: !config.totpEnabled || !config.recoveryCodesEnabled,
      storeBackupCodes: 'encrypted'
    }
  })
  const passkeys = passkey({
    rpID: new URL(config.publicURL).hostname,
    rpName: config.passkeyRPName,
    origin: new URL(config.publicURL).origin
  })
  const devices = deviceAuthorization({
    verificationUri: new URL('/auth/device', config.publicURL).href,
    validateClient: (clientId) => clientId.startsWith('openpencil-desktop:')
  })
  const administration = admin()
  const auth = betterAuth({
    appName: 'OpenPencil Cloud',
    baseURL: config.publicURL,
    basePath: AUTH_BASE_PATH,
    // Clients never reach Better Auth's own administration, which `/api/admin` replaces with MFA,
    // origin, last-administrator, and audit checks, nor the two endpoints Cloud's policy manages
    // through its account routes; the server still calls them itself.
    disabledPaths: [
      ...Object.values(administration.endpoints).map((endpoint) => endpoint.path),
      passkeys.endpoints.deletePasskey.path,
      twoStep.endpoints.disableTwoFactor.path
    ],
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
      database: { generateId: 'uuid', validateSchema: runtime.validateSchema },
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
        [devices.endpoints.deviceCode.path]: { window: 60, max: 10 },
        [devices.endpoints.deviceToken.path]: { window: 60, max: 60 },
        [devices.endpoints.deviceApprove.path]: { window: 60, max: 10 },
        [devices.endpoints.deviceDeny.path]: { window: 60, max: 10 },
        [CORE_AUTH_PATHS.signInEmail]: { window: 10, max: 3 },
        [CORE_AUTH_PATHS.signUpEmail]: { window: 10, max: 3 },
        [CORE_AUTH_PATHS.requestPasswordReset]: { window: 60, max: 3 },
        [CORE_AUTH_PATHS.sendVerificationEmail]: { window: 60, max: 3 }
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
            // Signing in unverified only says so; people ask for another link with Send again.
            sendOnSignIn: false,
            autoSignInAfterVerification: true,
            // A change of address sends the link to the new address as `user.email`, on the
            // account it already confirmed; a new account has not confirmed one yet. This runs
            // inside sign-up's transaction, so it must not query the database itself.
            sendVerificationEmail: ({ user, url, token }) =>
              authenticationEmail.sendVerification({
                email: user.email,
                name: user.name,
                url,
                token,
                purpose: user.emailVerified ? 'change' : 'account'
              }),
            afterEmailVerification: async (user) => {
              await enrollment.followEmailChange(user.id, user.email)
              if (config.enrollmentMode === 'approval') {
                await enrollment.request({ email: user.email, name: user.name })
              }
              await enrollment.bindApprovedUser(user.email, user.id)
            }
          }
        : undefined,
    user: {
      changeEmail: { enabled: emailChangeAvailable },
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
              endpoints: [
                CORE_AUTH_PATHS.signUpEmail,
                CORE_AUTH_PATHS.signInEmail,
                CORE_AUTH_PATHS.requestPasswordReset
              ]
            })
          ]
        : []),
      ...(config.compromisedPasswordCheck ? [haveIBeenPwned()] : []),
      twoStep,
      passkeys,
      administration,
      // Device authorization returns opaque database session tokens, not signed cookies.
      bearer(),
      devices,
      // After two-step sign-in's own hooks, so a sign-in waiting for its second step is skipped.
      accountActivity(
        activity,
        { twoStep: twoStep.endpoints, passkeys: passkeys.endpoints, devices: devices.endpoints },
        (user) => notifyTwoStep(user, 'passkey-added')
      ),
      providerPictures(createUserPictures(database, { publicURL: config.publicURL }))
    ],
    socialProviders: socialProviders(config),
    trustedOrigins: [
      config.publicURL,
      ...config.trustedOrigins,
      ...(config.appleClientId ? [APPLE_AUDIENCE] : [])
    ]
  })

  // Administrators are granted only through the `admin` command or by another administrator.
  const deploymentRole = (user: { id: string; role?: string | null }) =>
    user.role === 'admin' ? ('admin' as const) : ('user' as const)

  const resolveIdentity = async (headers: Headers) => {
    const session = await auth.api.getSession({ headers })
    if (!session) return null
    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
      deploymentRole: deploymentRole(session.user)
    }
  }

  /** The signed-in person, read past the cookie cache, for changes about their own account. */
  const currentSession = (headers: Headers) =>
    auth.api.getSession({ headers, query: { disableCookieCache: true } })

  /** The current session when it signed in recently enough to change how the account is reached. */
  async function freshSession(headers: Headers) {
    const session = await currentSession(headers)
    const createdAt = session?.session.createdAt
    if (
      !session ||
      !createdAt ||
      Date.now() - new Date(createdAt).getTime() >= ACCOUNT_SECURITY_FRESH_AGE_SECONDS * 1000
    ) {
      throw APIError.from('FORBIDDEN', {
        code: 'SESSION_NOT_FRESH',
        message: 'Session is not fresh'
      })
    }
    return session
  }

  async function notifyTwoStep(
    user: { id: string; email: string; name: string },
    change: Parameters<AuthenticationEmailService['sendTwoStepChanged']>[0]['change']
  ): Promise<void> {
    await authenticationEmail?.sendTwoStepChanged({
      email: user.email,
      name: user.name,
      userId: user.id,
      change
    })
  }

  /** The signed-in person while their account may use the server, which awaiting approval it may not. */
  async function resolveSession(headers: Headers) {
    const identity = await resolveIdentity(headers)
    if (!identity) return null
    if (config.enrollmentMode === 'approval' && !(await enrollment.isApproved(identity.email))) {
      return null
    }
    return identity
  }

  /**
   * The endpoints that read or change an account, which only an account that may use the server
   * reaches; one awaiting approval still signs in and out. Better Auth checks the session inside
   * most of these endpoints rather than declaring it, so they are listed by their own objects.
   */
  const activeAccountPaths = new Set(
    [
      auth.api.generatePasskeyRegistrationOptions,
      auth.api.listPasskeys,
      auth.api.updatePasskey,
      auth.api.verifyPasskeyRegistration,
      auth.api.enableTwoFactor,
      auth.api.generateBackupCodes,
      auth.api.getTOTPURI,
      auth.api.accountInfo,
      auth.api.changeEmail,
      auth.api.changePassword,
      auth.api.deleteUser,
      auth.api.getAccessToken,
      auth.api.linkSocialAccount,
      auth.api.listUserAccounts,
      auth.api.listSessions,
      auth.api.refreshToken,
      auth.api.revokeOtherSessions,
      auth.api.revokeSession,
      auth.api.revokeSessions,
      auth.api.unlinkAccount
    ].map((endpoint) => authRequestPath(endpoint.path))
  )
  /** The second factor a request proves, by the endpoint it is for. */
  const assuranceMethods = new Map<string, 'totp' | 'recovery-code' | 'passkey'>([
    [authRequestPath(twoStep.endpoints.verifyTOTP.path), 'totp'],
    [authRequestPath(twoStep.endpoints.verifyBackupCode.path), 'recovery-code'],
    [authRequestPath(passkeys.endpoints.verifyPasskeyAuthentication.path), 'passkey']
  ])

  return {
    handler: async (request) => {
      const path = new URL(request.url).pathname
      if (activeAccountPaths.has(path) && !(await resolveSession(request.headers))) {
        return Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
      }
      const response = await auth.handler(request)
      const method = assuranceMethods.get(path)
      if (response.ok && method)
        await recordResponseAssurance(response, method, database, assurance)
      return response
    },
    resolveIdentity,
    resolveSession,
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
      await freshSession(headers)
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
        deploymentRole: deploymentRole(session.user),
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
      const before = await currentSession(headers)
      const response = await verifySecondFactor(
        auth,
        config,
        database,
        assurance,
        headers,
        code,
        'totp',
        twoStep.endpoints.verifyTOTP
      )
      // The first code from a new authenticator is what turns it on.
      if (before && !('twoFactorEnabled' in before.user && before.user.twoFactorEnabled === true)) {
        await notifyTwoStep(before.user, 'authenticator-on')
      }
      return response
    },
    async verifyRecoveryCode(headers, code) {
      return verifySecondFactor(
        auth,
        config,
        database,
        assurance,
        headers,
        code,
        'recovery-code',
        twoStep.endpoints.verifyBackupCode
      )
    },
    async generateRecoveryCodes(headers, password) {
      return (await auth.api.generateBackupCodes({ headers, body: { password } })).backupCodes
    },
    async disableTOTP(headers, password) {
      await auth.api.disableTwoFactor({ headers, body: { password } })
      const session = await currentSession(headers)
      if (session) await notifyTwoStep(session.user, 'authenticator-off')
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
      const session = await currentSession(headers)
      if (session) await notifyTwoStep(session.user, 'passkey-removed')
    },
    emailChangeAvailable,
    async profile(headers) {
      const session = await currentSession(headers)
      if (!session) return null
      return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        createdAt: new Date(session.user.createdAt)
      }
    },
    async updateProfile(headers, input) {
      await auth.api.updateUser({ headers, body: { name: input.name } })
    },
    async changeEmail(headers, input) {
      const session = await freshSession(headers)
      if (session.user.email === input.newEmail) {
        throw APIError.from('BAD_REQUEST', {
          code: 'EMAIL_UNCHANGED',
          message: 'Email is the same'
        })
      }
      await auth.api.changeEmail({ headers, body: input })
      await authenticationEmail?.sendEmailChangeRequested({
        email: session.user.email,
        name: session.user.name,
        userId: session.user.id,
        newEmail: input.newEmail
      })
    },
    async sessions(headers) {
      const session = await currentSession(headers)
      if (!session) return null
      return activity.sessions(session.user.id, session.session.id)
    },
    async revokeSession(headers, sessionId) {
      const session = await currentSession(headers)
      if (!session) throw APIError.fromStatus('UNAUTHORIZED')
      if (session.session.id === sessionId) {
        throw APIError.from('BAD_REQUEST', {
          code: 'CURRENT_SESSION',
          message: 'Sign out to end this session'
        })
      }
      const target = await database
        .selectFrom('session')
        .select('token')
        .where('id', '=', sessionId)
        .where('userId', '=', session.user.id)
        .executeTakeFirst()
      if (target) await auth.api.revokeSession({ headers, body: { token: target.token } })
    },
    async revokeOtherSessions(headers) {
      await auth.api.revokeOtherSessions({ headers })
    },
    async signIns(headers) {
      const session = await currentSession(headers)
      return session ? activity.signIns(session.user.id) : null
    },
    schemaVersion: BETTER_AUTH_SCHEMA_VERSION,
    async migrate() {
      const migrations = await getMigrations(auth.options)
      await migrations.runMigrations()
    }
  }
}
