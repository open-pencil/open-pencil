import { expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-test/helpers/account-authentication'

import { signOutFromCloud } from '@open-pencil/cloud/client'
import { parseCloudDiscovery } from '@open-pencil/cloud/contract'

test('email-only desktop authorization stays on its issuing instance with a separate editor', async () => {
  const fixture = await createAccountAuthenticationFixture({
    config: {
      ...accountAuthenticationConfig,
      appURL: 'https://editor.example.com',
      trustedOrigins: ['https://editor.example.com']
    }
  })
  try {
    const clientId = 'openpencil-desktop:test-connection'
    const issued = await fixture.app.fetch(
      accountAuthenticationRequest('/api/auth/device/code', {
        client_id: clientId,
        scope: 'openid profile'
      })
    )
    expect(issued.status).toBe(200)
    const authorization = (await issued.json()) as {
      user_code: string
      device_code: string
      verification_uri: string
      verification_uri_complete: string
    }
    expect(authorization.verification_uri).toBe('https://cloud.example.com/cloud/device')
    expect(new URL(authorization.verification_uri_complete).origin).toBe(
      'https://cloud.example.com'
    )
    const user = await createVerifiedCredentialAccount(fixture, {
      email: 'desktop@example.com',
      name: 'Desktop user',
      password: 'desktop-password-long-enough',
      approved: true
    })
    const inspected = await fixture.app.fetch(
      accountAuthenticationRequest(
        `/api/auth/device?user_code=${authorization.user_code}`,
        undefined,
        user.sessionCookie
      )
    )
    expect(inspected.status).toBe(200)
    const approved = await fixture.app.fetch(
      accountAuthenticationRequest(
        '/api/auth/device/approve',
        { userCode: authorization.user_code },
        user.sessionCookie
      )
    )
    expect({ status: approved.status, body: await approved.json() }).toMatchObject({ status: 200 })
    const token = await fixture.app.fetch(
      accountAuthenticationRequest('/api/auth/device/token', {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: authorization.device_code,
        client_id: clientId
      })
    )
    expect(token.status).toBe(200)
    const tokenBody = (await token.json()) as { access_token: string; token_type: string }
    expect(tokenBody.token_type).toBe('Bearer')
    expect(typeof tokenBody.access_token).toBe('string')
    const stored = await fixture.database
      .selectFrom('session')
      .select(['userId', 'expiresAt'])
      .where('token', '=', tokenBody.access_token)
      .executeTakeFirst()
    expect(stored?.userId).toBe(user.userId)
    expect(new Date(stored?.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now())
    const discoveryResponse = await fixture.app.fetch(
      accountAuthenticationRequest('/.well-known/openpencil')
    )
    const discovery = parseCloudDiscovery(await discoveryResponse.json())
    const session = await fixture.app.fetch(
      new Request('https://cloud.example.com/api/session', {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` }
      })
    )
    expect(session.status).toBe(200)
    const invalid = await fixture.app.fetch(
      new Request('https://cloud.example.com/api/session', {
        headers: { Authorization: `Bearer ${crypto.randomUUID()}` }
      })
    )
    expect(invalid.status).toBe(401)
    await signOutFromCloud(discovery, {
      accessToken: tokenBody.access_token,
      fetch: async (input, init) => fixture.app.fetch(new Request(input, init))
    })
    const revoked = await fixture.app.fetch(
      new Request('https://cloud.example.com/api/session', {
        headers: { Authorization: `Bearer ${tokenBody.access_token}` }
      })
    )
    expect(revoked.status).toBe(401)
  } finally {
    await fixture.close()
  }
})
