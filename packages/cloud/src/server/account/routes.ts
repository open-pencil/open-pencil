import type { EnrollmentService } from '#cloud/admin'
import {
  parseCloudPasswordChange,
  parseCloudMFAEnable,
  parseCloudMFAVerify,
  parseCloudPasskeyDelete,
  parseCloudSocialLink,
  parseCloudUnlinkAuthenticationMethod
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import {
  createAccountAuthenticationService,
  type CloudAuthAdapter,
  type CloudIdentityResolver,
  type CloudSessionResolver
} from '#cloud/server/auth'
import type { CloudServerConfig } from '#cloud/server/config'
import { validatedJSON } from '#cloud/server/validation'
import { Hono, type MiddlewareHandler } from 'hono'

import { createAccountActions } from './actions'

export type AccountRouteDependencies = {
  auth: CloudAuthAdapter
  config: CloudServerConfig
  enrollment: EnrollmentService
  resolveIdentity: CloudIdentityResolver
  resolveSession: CloudSessionResolver
  requireActiveSession: MiddlewareHandler<CloudAPIEnvironment>
  authenticatedMutationLimiter: MiddlewareHandler<CloudAPIEnvironment>
}

export function createAccountRoutes(services: AccountRouteDependencies) {
  const {
    enrollment,
    resolveIdentity,
    resolveSession,
    requireActiveSession,
    authenticatedMutationLimiter
  } = services
  const accountAuthentication = createAccountAuthenticationService(services.auth, services.config)
  const { accountAction, activeAccountAction, verifiedMFAAction } =
    createAccountActions(resolveSession)
  return new Hono<CloudAPIEnvironment>()
    .get('/api/account/status', async (context) => {
      const identity = await resolveIdentity(context.req.raw)
      if (!identity) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      let enrollmentStatus = await enrollment.statusForEmail(identity.email)
      if (services.config.enrollmentMode === 'approval' && !enrollmentStatus) {
        await enrollment.request({ email: identity.email, name: identity.name })
        enrollmentStatus = 'pending'
      }
      const state =
        services.config.enrollmentMode !== 'approval' || enrollmentStatus === 'approved'
          ? ('active' as const)
          : (enrollmentStatus ?? 'pending')
      return context.json({ user: identity, state })
    })
    .get('/api/account/mfa', async (context) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      const mfa = await services.auth.mfaStatus(context.req.raw.headers)
      return mfa
        ? context.json({ mfa })
        : context.json({ error: { code: 'unauthorized' as const } }, 401)
    })
    .post('/api/account/mfa/totp/enable', validatedJSON(parseCloudMFAEnable), async (context) => {
      const result = await activeAccountAction(context, () =>
        services.auth.enableTOTP(context.req.raw.headers, context.req.valid('json').password)
      )
      return result instanceof Response ? result : context.json(result)
    })
    .post('/api/account/mfa/totp/verify', validatedJSON(parseCloudMFAVerify), (context) =>
      verifiedMFAAction(context, resolveSession, () =>
        services.auth.verifyTOTP(context.req.raw.headers, context.req.valid('json').code)
      )
    )
    .post('/api/account/mfa/recovery/verify', validatedJSON(parseCloudMFAVerify), (context) =>
      verifiedMFAAction(context, resolveIdentity, () =>
        services.auth.verifyRecoveryCode(context.req.raw.headers, context.req.valid('json').code)
      )
    )
    .post(
      '/api/account/mfa/recovery/regenerate',
      validatedJSON(parseCloudMFAEnable),
      async (context) => {
        const result = await activeAccountAction(context, () =>
          services.auth.generateRecoveryCodes(
            context.req.raw.headers,
            context.req.valid('json').password
          )
        )
        return result instanceof Response ? result : context.json({ backupCodes: result })
      }
    )
    .post('/api/account/mfa/totp/disable', validatedJSON(parseCloudMFAEnable), async (context) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      if (actor.deploymentRole === 'admin' && services.config.deploymentAdminMFARequired) {
        const passkeys = await services.auth.listPasskeys(context.req.raw.headers)
        if (passkeys.length === 0) {
          return context.json({ error: { code: 'mfa_required' as const } }, 403)
        }
      }
      const result = await accountAction(
        () =>
          services.auth.disableTOTP(context.req.raw.headers, context.req.valid('json').password),
        context
      )
      return result instanceof Response ? result : context.json({ ok: true as const })
    })
    .get('/api/account/mfa/passkeys', async (context) => {
      const actor = await resolveSession(context.req.raw)
      if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
      return context.json({ passkeys: await services.auth.listPasskeys(context.req.raw.headers) })
    })
    .post(
      '/api/account/mfa/passkeys/delete',
      validatedJSON(parseCloudPasskeyDelete),
      async (context) => {
        const actor = await resolveSession(context.req.raw)
        if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        const status = await services.auth.mfaStatus(context.req.raw.headers)
        const passkeys = await services.auth.listPasskeys(context.req.raw.headers)
        if (
          actor.deploymentRole === 'admin' &&
          services.config.deploymentAdminMFARequired &&
          !status?.enabled &&
          passkeys.length <= 1
        ) {
          return context.json({ error: { code: 'mfa_required' as const } }, 403)
        }
        await services.auth.deletePasskey(context.req.raw.headers, context.req.valid('json').id)
        return context.json({ ok: true as const })
      }
    )
    .use('/api/account/authentication/*', requireActiveSession)
    .use('/api/account/authentication/*', authenticatedMutationLimiter)
    .post(
      '/api/account/authentication/change-password',
      validatedJSON(parseCloudPasswordChange),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.changePassword(
              context.req.raw.headers,
              context.req.valid('json')
            ),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      }
    )
    .post(
      '/api/account/authentication/link-social',
      validatedJSON(parseCloudSocialLink),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.startSocialLink(
              context.req.raw.headers,
              context.req.valid('json')
            ),
          context
        )
        return result instanceof Response ? result : context.json({ url: result })
      }
    )
    .post(
      '/api/account/authentication/unlink',
      validatedJSON(parseCloudUnlinkAuthenticationMethod),
      async (context) => {
        const result = await accountAction(
          () =>
            accountAuthentication.unlink(
              context.req.raw.headers,
              context.req.valid('json').methodId
            ),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      }
    )
    .get('/api/account/authentication', async (context) => {
      const result = await accountAction(
        () => accountAuthentication.methods(context.req.raw.headers),
        context
      )
      return result instanceof Response ? result : context.json(result)
    })
}
