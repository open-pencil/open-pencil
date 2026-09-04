import { createCloudTestDatabase } from '#cloud-test/helpers/database'

import {
  createCloudApp,
  createBetterAuthAdapter,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'

export const accountAuthenticationConfig = parseCloudServerConfig({
  deployment: 'self-hosted',
  publicURL: 'https://cloud.example.com',
  databaseURL: 'postgresql://test:test@localhost/test',
  authSecret: 'account-authentication-test-secret-at-least-32-characters',
  enrollmentMode: 'approval',
  emailPasswordEnabled: true,
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

const ignore = async (): Promise<void> => {
  await Promise.resolve()
}

export function accountAuthenticationRequest(
  path: string,
  body?: object,
  cookie?: string
): Request {
  const headers = new Headers()
  if (body) headers.set('Content-Type', 'application/json')
  if (cookie) headers.set('Cookie', cookie)
  return new Request(new URL(path, accountAuthenticationConfig.publicURL), {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
}

export function authenticationCookie(response: Response): string {
  const value = response.headers.get('set-cookie')?.split(';', 1)[0]
  if (!value) throw new Error('Authentication response did not set a cookie')
  return value
}

export function accountAuthenticationObjects() {
  return {
    capabilities: { nativeSHA256: true, multipartUpload: false, conditionalWrites: false },
    async checkReadiness() {
      return { ok: true, checksumVerification: 'native' as const }
    },
    async createDownload() {
      throw new Error('not used')
    },
    async createUpload() {
      throw new Error('not used')
    },
    completeUpload: ignore,
    abortUpload: ignore,
    async head() {
      return null
    },
    delete: ignore
  }
}

export async function createAccountAuthenticationFixture(
  options: {
    config?: typeof accountAuthenticationConfig
    onPasswordChanged?: () => void
  } = {}
) {
  const config = options.config ?? accountAuthenticationConfig
  const runtime = await createCloudTestDatabase()
  const auth = createBetterAuthAdapter(config, runtime.database, undefined, {
    email: {
      sendVerification: ignore,
      sendPasswordReset: ignore,
      async sendPasswordChanged() {
        options.onPasswordChanged?.()
      }
    }
  })
  return {
    ...runtime,
    app: createCloudApp({
      config,
      database: runtime.database,
      auth,
      objects: accountAuthenticationObjects()
    })
  }
}

export async function approveAccount(
  database: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>['database'],
  input: { email: string; name: string; userId: string }
): Promise<void> {
  await database
    .insertInto('cloudEnrollment')
    .values({
      id: crypto.randomUUID(),
      emailNormalized: input.email,
      name: input.name,
      reason: null,
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: 'admin',
      reviewNote: null,
      approvedUserId: input.userId
    })
    .execute()
}

export async function createVerifiedCredentialAccount(
  fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>,
  input: { email: string; name: string; password: string; approved: boolean }
): Promise<{ userId: string; sessionCookie: string }> {
  await fixture.app.fetch(
    accountAuthenticationRequest('/api/auth/sign-up/email', {
      name: input.name,
      email: input.email,
      password: input.password
    })
  )
  const user = await fixture.database
    .selectFrom('user')
    .select('id')
    .where('email', '=', input.email)
    .executeTakeFirstOrThrow()
  await fixture.database
    .updateTable('user')
    .set({ emailVerified: true })
    .where('id', '=', user.id)
    .execute()
  if (input.approved) {
    await approveAccount(fixture.database, {
      email: input.email,
      name: input.name,
      userId: user.id
    })
  }
  const signIn = await fixture.app.fetch(
    accountAuthenticationRequest('/api/auth/sign-in/email', {
      email: input.email,
      password: input.password
    })
  )
  return { userId: user.id, sessionCookie: authenticationCookie(signIn) }
}
