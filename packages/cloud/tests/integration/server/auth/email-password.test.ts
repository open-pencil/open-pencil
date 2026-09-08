import { describe, expect, test } from 'bun:test'

import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createAuthenticationEmailService,
  createBetterAuthAdapter,
  createEnrollmentService,
  createTransactionalEmailService,
  parseCloudServerConfig,
  type AuthenticationEmailService
} from '@open-pencil/cloud/server'

const config = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'email-password-test-secret-at-least-32-characters',
  enrollmentMode: 'approval',
  emailPasswordEnabled: true,
  emailPasswordMinimumLength: 15,
  emailTransport: 'smtp',
  emailFrom: 'cloud@example.com',
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpSecure: true,
  s3Endpoint: 'https://objects.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'access-key',
  s3SecretAccessKey: 'secret-key'
})

async function runtime(authenticationEmail?: AuthenticationEmailService) {
  const databaseRuntime = await createCloudTestDatabase()
  const email = createTransactionalEmailService(databaseRuntime.database, {
    encryptionSecret: config.authSecret,
    from: config.emailFrom ?? ''
  })
  const enrollment = createEnrollmentService(databaseRuntime.database, {
    appURL: config.publicURL,
    adminRecipients: [],
    email
  })
  const auth = createBetterAuthAdapter(config, databaseRuntime.database, enrollment, {
    email: authenticationEmail ?? createAuthenticationEmailService(email, config.publicURL)
  })
  return { ...databaseRuntime, auth, enrollment }
}

function authRequest(path: string, body: object): Request {
  return new Request(new URL(`/api/auth${path}`, config.publicURL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: config.publicURL },
    body: JSON.stringify(body)
  })
}

async function ignoreAuthenticationEmail(): Promise<void> {
  await Promise.resolve()
}

function sessionHeaders(response: Response): Headers {
  const setCookie = response.headers.get('set-cookie')
  const cookie = setCookie?.split(';', 1)[0]
  if (!cookie) throw new Error('Authentication response did not set a session cookie')
  return new Headers({ Cookie: cookie })
}

describe('email and password authentication', () => {
  test('enrolls credential accounts only after email verification', async () => {
    let verificationURL = ''
    const app = await runtime({
      async sendVerification(input) {
        verificationURL = input.url
      },
      sendPasswordReset: ignoreAuthenticationEmail,
      sendPasswordChanged: ignoreAuthenticationEmail
    })
    try {
      const response = await app.auth.handler(
        authRequest('/sign-up/email', {
          name: 'Person',
          email: 'person@example.com',
          password: 'a sufficiently long password',
          callbackURL: 'https://cloud.example.com/auth/verify-email?state=verified'
        })
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ token: null })
      expect(await app.enrollment.statusForEmail('person@example.com')).toBeNull()
      expect(
        await app.database
          .selectFrom('user')
          .select(['email', 'emailVerified'])
          .where('email', '=', 'person@example.com')
          .executeTakeFirstOrThrow()
      ).toEqual({ email: 'person@example.com', emailVerified: false })
      expect(verificationURL).toContain('/api/auth/verify-email?token=')
      expect(
        await app.database
          .selectFrom('transactionalEmail')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 0 })

      const verification = await app.auth.handler(new Request(verificationURL))
      expect(verification.status).toBe(302)
      expect(await app.enrollment.statusForEmail('person@example.com')).toBe('pending')
    } finally {
      await app.close()
    }
  })

  test('revokes existing sessions and notifies after a password reset', async () => {
    let verificationURL = ''
    let resetToken = ''
    let passwordChanged = false
    const app = await runtime({
      async sendVerification(input) {
        verificationURL = input.url
      },
      async sendPasswordReset(input) {
        resetToken = input.token
      },
      async sendPasswordChanged() {
        passwordChanged = true
      }
    })
    try {
      await app.auth.handler(
        authRequest('/sign-up/email', {
          name: 'Reset Person',
          email: 'reset@example.com',
          password: 'the original long password',
          callbackURL: 'https://cloud.example.com/auth/verify-email?state=verified'
        })
      )
      await app.auth.handler(new Request(verificationURL))
      const signIn = await app.auth.handler(
        authRequest('/sign-in/email', {
          email: 'reset@example.com',
          password: 'the original long password'
        })
      )
      expect(signIn.status).toBe(200)
      const headers = sessionHeaders(signIn)
      expect(await app.auth.resolveIdentity(headers)).toMatchObject({
        email: 'reset@example.com'
      })

      const request = await app.auth.handler(
        authRequest('/request-password-reset', {
          email: 'reset@example.com',
          redirectTo: 'https://cloud.example.com/auth/reset-password'
        })
      )
      expect(request.status).toBe(200)
      expect(resetToken).not.toBe('')
      const reset = await app.auth.handler(
        authRequest('/reset-password', {
          token: resetToken,
          newPassword: 'the replacement long password'
        })
      )
      expect(reset.status).toBe(200)
      expect(passwordChanged).toBe(true)
      expect(await app.auth.resolveIdentity(headers)).toBeNull()

      const reusedToken = await app.auth.handler(
        authRequest('/reset-password', {
          token: resetToken,
          newPassword: 'another sufficiently long password'
        })
      )
      expect(reusedToken.status).toBe(400)
      expect(await reusedToken.json()).toMatchObject({ code: 'INVALID_TOKEN' })
      const newSignIn = await app.auth.handler(
        authRequest('/sign-in/email', {
          email: 'reset@example.com',
          password: 'the replacement long password'
        })
      )
      expect(newSignIn.status).toBe(200)
    } finally {
      await app.close()
    }
  })

  test('returns an indistinguishable sign-up response for an existing email', async () => {
    const app = await runtime({
      sendVerification: ignoreAuthenticationEmail,
      sendPasswordReset: ignoreAuthenticationEmail,
      sendPasswordChanged: ignoreAuthenticationEmail
    })
    try {
      const first = await app.auth.handler(
        authRequest('/sign-up/email', {
          name: 'Existing Person',
          email: 'existing@example.com',
          password: 'a sufficiently long password',
          callbackURL: 'https://cloud.example.com/auth/verify-email?state=verified'
        })
      )
      const duplicate = await app.auth.handler(
        authRequest('/sign-up/email', {
          name: 'Different Name',
          email: 'existing@example.com',
          password: 'another sufficiently long password',
          callbackURL: 'https://cloud.example.com/auth/verify-email?state=verified'
        })
      )
      expect(first.status).toBe(200)
      expect(duplicate.status).toBe(200)
      expect(await duplicate.json()).toMatchObject({
        token: null,
        user: { email: 'existing@example.com', emailVerified: false }
      })
    } finally {
      await app.close()
    }
  })

  test('returns the same credential error for unknown users and wrong passwords', async () => {
    const app = await runtime()
    try {
      const unknown = await app.auth.handler(
        authRequest('/sign-in/email', {
          email: 'unknown@example.com',
          password: 'a sufficiently long password'
        })
      )
      expect(unknown.status).toBe(401)
      expect(await unknown.json()).toMatchObject({ code: 'INVALID_EMAIL_OR_PASSWORD' })
    } finally {
      await app.close()
    }
  })

  test('returns an opaque password-reset result for unknown users', async () => {
    const app = await runtime()
    try {
      const response = await app.auth.handler(
        authRequest('/request-password-reset', {
          email: 'unknown@example.com',
          redirectTo: 'https://cloud.example.com/auth/reset-password'
        })
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status: true })
      expect(
        await app.database
          .selectFrom('transactionalEmail')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .executeTakeFirstOrThrow()
      ).toEqual({ count: 0 })
    } finally {
      await app.close()
    }
  })
})
