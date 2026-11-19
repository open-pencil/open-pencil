import type { EnrollmentService } from '#cloud/admin'
import {
  cloudPasswordChangeSchema,
  cloudMFAEnableSchema,
  cloudMFAVerifySchema,
  cloudPasskeyDeleteSchema,
  cloudSocialLinkSchema,
  cloudUnlinkAuthenticationMethodSchema,
  cloudEmailChangeSchema,
  cloudProfileUpdateSchema,
  cloudLocaleUpdateSchema,
  cloudPictureUploadSchema,
  CLOUD_PICTURE_MAX_BYTES,
  cloudSessionRevokeSchema,
  cloudAccountDeleteSchema,
  cloudTermsAcceptanceSchema,
  type CloudAccountStatus
} from '#cloud/contract'
import type { CloudAPIEnvironment } from '#cloud/server/api'
import {
  createAccountAuthenticationService,
  type CloudAuthAdapter,
  type CloudIdentityResolver,
  type CloudSessionResolver
} from '#cloud/server/auth'
import type { CloudServerConfig } from '#cloud/server/config'
import { PictureInvalidError, type UserPictureService } from '#cloud/server/pictures'
import { validatedJSON } from '#cloud/server/validation'
import type { WorkspaceService } from '#cloud/server/workspaces'
import { Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { toUint8Array } from 'js-base64'

import { createAccountActions } from './actions'
import type { AccountDeletionService } from './deletion'
import type { TermsService } from './terms'

/** Room for a Base64 picture and the JSON around it. */
const PICTURE_BODY_BYTES = Math.ceil(CLOUD_PICTURE_MAX_BYTES / 3) * 4 + 1024

export type AccountRouteDependencies = {
  auth: CloudAuthAdapter
  config: CloudServerConfig
  pictures: UserPictureService
  enrollment: EnrollmentService
  workspaces: WorkspaceService
  deletion: AccountDeletionService
  terms: TermsService
  resolveIdentity: CloudIdentityResolver
  resolveSession: CloudSessionResolver
  /** Whether the request's session proved its account's second step, or the account has none. */
  twoStepConfirmed: (request: Request) => Promise<boolean>
  requireActiveSession: MiddlewareHandler<CloudAPIEnvironment>
  /** Lets an account with terms to accept reach what leaving needs; see `resolveAccountSession`. */
  requireAccountSession: MiddlewareHandler<CloudAPIEnvironment>
  authenticatedMutationLimiter: MiddlewareHandler<CloudAPIEnvironment>
}

export function createAccountRoutes(services: AccountRouteDependencies) {
  const {
    enrollment,
    workspaces,
    resolveIdentity,
    resolveSession,
    twoStepConfirmed,
    requireActiveSession,
    authenticatedMutationLimiter
  } = services
  const accountAuthentication = createAccountAuthenticationService(services.auth, services.config)
  const { accountAction, activeAccountAction, verifiedMFAAction } =
    createAccountActions(resolveSession)
  return (
    new Hono<CloudAPIEnvironment>()
      .get('/api/account/status', async (context) => {
        const identity = await resolveIdentity(context.req.raw)
        if (!identity) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        let enrollmentStatus = await enrollment.statusForEmail(identity.email)
        if (services.config.enrollmentMode === 'approval' && !enrollmentStatus) {
          await enrollment.request({ email: identity.email, name: identity.name })
          enrollmentStatus = 'pending'
        }
        // Waiting or declined, from enrollment; null once the account may use the server.
        const enrollmentState =
          services.config.enrollmentMode !== 'approval' || enrollmentStatus === 'approved'
            ? null
            : (enrollmentStatus ?? 'pending')
        // The second step comes after approval, and terms after it: an account still waiting has
        // nothing to prove or accept yet.
        let state: CloudAccountStatus['state'] = enrollmentState ?? 'active'
        if (!enrollmentState && !(await twoStepConfirmed(context.req.raw))) {
          state = 'two-step'
        } else if (!enrollmentState && !(await services.terms.hasAccepted(identity.userId))) {
          state = 'terms'
        }
        if (state === 'active') await workspaces.ensurePersonal(identity)
        return context.json({ user: identity, state })
      })
      .post('/api/account/terms', validatedJSON(cloudTermsAcceptanceSchema), async (context) => {
        const identity = await resolveIdentity(context.req.raw)
        if (!identity) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        if (!services.terms.requiredVersion) {
          return context.json({ error: { code: 'not_found' as const } }, 404)
        }
        // Accepting is for the version shown; one that changed meanwhile is read again first.
        if (!(await services.terms.accept(identity.userId, context.req.valid('json').version))) {
          return context.json({ error: { code: 'terms_changed' as const } }, 409)
        }
        return context.json({ ok: true as const })
      })
      // A session still proving its second step reads which ways it has, and proves one.
      .get('/api/account/mfa', async (context) => {
        const actor = await resolveIdentity(context.req.raw)
        if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        const mfa = await services.auth.mfaStatus(context.req.raw.headers)
        return mfa
          ? context.json({ mfa })
          : context.json({ error: { code: 'unauthorized' as const } }, 401)
      })
      .post(
        '/api/account/mfa/totp/enable',
        validatedJSON(cloudMFAEnableSchema),
        async (context) => {
          const result = await activeAccountAction(context, () =>
            services.auth.enableTOTP(context.req.raw.headers, context.req.valid('json').password)
          )
          return result instanceof Response ? result : context.json(result)
        }
      )
      .post('/api/account/mfa/totp/verify', validatedJSON(cloudMFAVerifySchema), (context) =>
        verifiedMFAAction(context, resolveIdentity, () =>
          services.auth.verifyTOTP(context.req.raw.headers, context.req.valid('json').code)
        )
      )
      .post('/api/account/mfa/recovery/verify', validatedJSON(cloudMFAVerifySchema), (context) =>
        verifiedMFAAction(context, resolveIdentity, () =>
          services.auth.verifyRecoveryCode(context.req.raw.headers, context.req.valid('json').code)
        )
      )
      .post(
        '/api/account/mfa/recovery/regenerate',
        validatedJSON(cloudMFAEnableSchema),
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
      .post(
        '/api/account/mfa/totp/disable',
        validatedJSON(cloudMFAEnableSchema),
        async (context) => {
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
              services.auth.disableTOTP(
                context.req.raw.headers,
                context.req.valid('json').password
              ),
            context
          )
          return result instanceof Response ? result : context.json({ ok: true as const })
        }
      )
      .get('/api/account/mfa/passkeys', async (context) => {
        const actor = await resolveSession(context.req.raw)
        if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        return context.json({ passkeys: await services.auth.listPasskeys(context.req.raw.headers) })
      })
      .post(
        '/api/account/mfa/passkeys/delete',
        validatedJSON(cloudPasskeyDeleteSchema),
        async (context) => {
          const actor = await resolveSession(context.req.raw)
          if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
          const { id } = context.req.valid('json')
          if (actor.deploymentRole === 'admin' && services.config.deploymentAdminMFARequired) {
            // An administrator keeps at least one second factor: TOTP or another passkey.
            const status = await services.auth.mfaStatus(context.req.raw.headers)
            const passkeys = await services.auth.listPasskeys(context.req.raw.headers)
            const otherPasskeys = passkeys.filter((passkey) => passkey.id !== id)
            if (!status?.totpEnabled && otherPasskeys.length === 0) {
              return context.json({ error: { code: 'mfa_required' as const } }, 403)
            }
          }
          const result = await accountAction(
            () => services.auth.deletePasskey(context.req.raw.headers, id),
            context
          )
          return result instanceof Response ? result : context.json({ ok: true as const })
        }
      )
      .use('/api/account/authentication/*', requireActiveSession)
      .use('/api/account/authentication/*', authenticatedMutationLimiter)
      .post(
        '/api/account/authentication/change-password',
        validatedJSON(cloudPasswordChangeSchema),
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
        validatedJSON(cloudSocialLinkSchema),
        async (context) => {
          const result = await accountAction(
            () =>
              accountAuthentication.startSocialLink(
                context.req.raw.headers,
                context.req.valid('json')
              ),
            context
          )
          if (result instanceof Response) return result
          // The provider's callback checks the state cookie this sets.
          for (const cookie of result.headers.getSetCookie()) {
            context.header('Set-Cookie', cookie, { append: true })
          }
          return context.json({ url: result.url })
        }
      )
      .post(
        '/api/account/authentication/unlink',
        validatedJSON(cloudUnlinkAuthenticationMethodSchema),
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
      .use('/api/account/profile', requireActiveSession)
      .use('/api/account/profile/*', requireActiveSession)
      .use('/api/account/sessions', requireActiveSession)
      .use('/api/account/sessions/*', requireActiveSession)
      .use('/api/account/sign-ins', requireActiveSession)
      .use('/api/account/deletion', services.requireAccountSession)
      .use('/api/account/delete', services.requireAccountSession)
      .use('/api/account/delete', authenticatedMutationLimiter)
      .use('/api/account/profile', authenticatedMutationLimiter)
      // An account awaiting approval or the terms is written to too, so any signed-in one may.
      .use('/api/account/locale', async (context, next) => {
        const actor = await resolveIdentity(context.req.raw)
        if (!actor) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        context.set('actor', actor)
        return next()
      })
      .use('/api/account/locale', authenticatedMutationLimiter)
      .use('/api/account/profile/*', authenticatedMutationLimiter)
      .use('/api/account/sessions/*', authenticatedMutationLimiter)
      .get('/api/account/profile', async (context) => {
        const profile = await services.auth.profile(context.req.raw.headers)
        if (!profile) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        return context.json({
          profile: {
            ...profile,
            createdAt: profile.createdAt.toISOString(),
            emailChangeAvailable: services.auth.emailChangeAvailable
          }
        })
      })
      .post('/api/account/profile', validatedJSON(cloudProfileUpdateSchema), async (context) => {
        const result = await accountAction(
          () => services.auth.updateProfile(context.req.raw.headers, context.req.valid('json')),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      })
      // The app says which language it uses after signing in and whenever the person changes it.
      .put('/api/account/locale', validatedJSON(cloudLocaleUpdateSchema), async (context) => {
        const result = await accountAction(
          () => services.auth.setLocale(context.req.raw.headers, context.req.valid('json').locale),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      })
      .put(
        '/api/account/profile/picture',
        bodyLimit({
          maxSize: PICTURE_BODY_BYTES,
          onError: (context) => context.json({ error: { code: 'picture_invalid' as const } }, 413)
        }),
        validatedJSON(cloudPictureUploadSchema),
        async (context) => {
          const bytes = toUint8Array(context.req.valid('json').data)
          try {
            const image = await services.pictures.upload(context.get('actor').userId, bytes)
            return context.json({ image })
          } catch (error) {
            if (!(error instanceof PictureInvalidError)) throw error
            return context.json({ error: { code: 'picture_invalid' as const } }, 400)
          }
        }
      )
      .delete('/api/account/profile/picture', async (context) => {
        await services.pictures.remove(context.get('actor').userId)
        return context.json({ ok: true as const })
      })
      .post(
        '/api/account/profile/email',
        validatedJSON(cloudEmailChangeSchema),
        async (context) => {
          const result = await accountAction(
            () =>
              accountAuthentication.changeEmail(context.req.raw.headers, context.req.valid('json')),
            context
          )
          return result instanceof Response ? result : context.json({ ok: true as const })
        }
      )
      .get('/api/account/sessions', async (context) => {
        const sessions = await services.auth.sessions(context.req.raw.headers)
        if (!sessions) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        return context.json({ sessions })
      })
      .post(
        '/api/account/sessions/revoke',
        validatedJSON(cloudSessionRevokeSchema),
        async (context) => {
          const result = await accountAction(
            () =>
              services.auth.revokeSession(
                context.req.raw.headers,
                context.req.valid('json').sessionId
              ),
            context
          )
          return result instanceof Response ? result : context.json({ ok: true as const })
        }
      )
      .post('/api/account/sessions/revoke-others', async (context) => {
        const result = await accountAction(
          () => services.auth.revokeOtherSessions(context.req.raw.headers),
          context
        )
        return result instanceof Response ? result : context.json({ ok: true as const })
      })
      .get('/api/account/sign-ins', async (context) => {
        const signIns = await services.auth.signIns(context.req.raw.headers)
        if (!signIns) return context.json({ error: { code: 'unauthorized' as const } }, 401)
        return context.json({ signIns })
      })
      .get('/api/account/deletion', async (context) => {
        return context.json({ deletion: await services.deletion.plan(context.get('actor').userId) })
      })
      .post('/api/account/delete', validatedJSON(cloudAccountDeleteSchema), async (context) => {
        const result = await accountAction(
          () =>
            services.auth.deleteAccount(
              context.req.raw.headers,
              context.req.valid('json').password
            ),
          context
        )
        if (result instanceof Response) return result
        // The session is gone with the account; the cookie that named it goes too.
        for (const cookie of result.getSetCookie()) {
          context.header('Set-Cookie', cookie, { append: true })
        }
        return context.json({ ok: true as const })
      })
      .get('/api/account/authentication', async (context) => {
        const result = await accountAction(
          () => accountAuthentication.methods(context.req.raw.headers),
          context
        )
        return result instanceof Response ? result : context.json(result)
      })
  )
}

/** The account routes' types, for the portal's typed client. */
export type CloudAccountRoutes = ReturnType<typeof createAccountRoutes>
