import { describe, expect, test } from 'bun:test'

import {
  resendCloudVerification,
  signInToCloudWithEmail,
  signUpToCloudWithEmail,
  type CloudFetch
} from '#cloud/client'
import { parseCloudDiscovery } from '#cloud/contract'

const discovery = parseCloudDiscovery({
  protocolVersion: '1',
  deployment: 'self-hosted' as const,
  apiURL: 'https://cloud.example.com/api',
  authURL: 'https://cloud.example.com/api/auth',
  authentication: {
    socialProviders: [],
    emailPassword: { signIn: true, signUp: true, minimumPasswordLength: 8 },
    enterpriseSSO: false
  },
  capabilities: { documents: true, workspaces: true, collaboration: true }
})

const CREDENTIALS = { email: 'ada@example.com', password: 'correct horse' }

function answering(body: unknown, status = 200): { fetch: CloudFetch; requests: Request[] } {
  const requests: Request[] = []
  const fetch: CloudFetch = async (input, init) => {
    requests.push(new Request(input, init))
    return Response.json(body, { status })
  }
  return { fetch, requests }
}

describe('signing in to Cloud with an email and password', () => {
  test('keeps the session token the server answers with', async () => {
    const { fetch, requests } = answering({ redirect: false, token: 'session-token', user: {} })

    const result = await signInToCloudWithEmail(discovery, CREDENTIALS, { fetch })

    expect(result).toEqual({ ok: true, value: { status: 'signed-in', token: 'session-token' } })
    expect(requests[0]?.url).toBe('https://cloud.example.com/api/auth/sign-in/email')
  })

  test('reports a second step instead of a token', async () => {
    const { fetch } = answering({ twoFactorRedirect: true })

    const result = await signInToCloudWithEmail(discovery, CREDENTIALS, { fetch })

    expect(result).toEqual({ ok: true, value: { status: 'two-step' } })
  })

  test('tells an unconfirmed email from a wrong password', async () => {
    const unverified = answering({ code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' }, 403)
    const wrong = answering({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid' }, 401)

    expect(await signInToCloudWithEmail(discovery, CREDENTIALS, unverified)).toEqual({
      ok: false,
      failure: 'email-not-verified'
    })
    expect(await signInToCloudWithEmail(discovery, CREDENTIALS, wrong)).toEqual({
      ok: false,
      failure: 'invalid-credentials'
    })
  })

  test('says the server is unavailable when it cannot be reached', async () => {
    const fetch: CloudFetch = () => Promise.reject(new TypeError('Failed to fetch'))

    expect(await signInToCloudWithEmail(discovery, CREDENTIALS, { fetch })).toEqual({
      ok: false,
      failure: 'unavailable'
    })
  })
})

describe('joining Cloud with an email and password', () => {
  test('sends the verification link to the page it names', async () => {
    const { fetch, requests } = answering({ token: null, user: {} })

    const result = await signUpToCloudWithEmail(
      discovery,
      { ...CREDENTIALS, name: 'Ada', verifiedURL: 'https://cloud.example.com/auth/verified' },
      { fetch }
    )

    expect(result).toEqual({ ok: true, value: undefined })
    expect(await requests[0]?.json()).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      callbackURL: 'https://cloud.example.com/auth/verified'
    })
  })

  test('asks for another verification link', async () => {
    const { fetch, requests } = answering({ status: true })

    const result = await resendCloudVerification(
      discovery,
      { email: 'ada@example.com', verifiedURL: 'https://cloud.example.com/auth/verified' },
      { fetch }
    )

    expect(result).toEqual({ ok: true, value: undefined })
    expect(requests[0]?.url).toBe('https://cloud.example.com/api/auth/send-verification-email')
  })
})
