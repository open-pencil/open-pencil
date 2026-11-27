import { expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount
} from '#cloud-tests/helpers/account-authentication'
import { contractClient, outcome } from '#cloud-tests/helpers/contract'
import { responseJSON } from '#cloud-tests/helpers/response'
import { signOutFromCloud } from '#cloud/client'
import { parseCloudDiscovery } from '#cloud/contract'
import * as v from 'valibot'

test('email-only desktop authorization stays on its issuing instance', async () => {
  const fixture = await createAccountAuthenticationFixture({
    config: {
      ...accountAuthenticationConfig,
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
    const authorization = await responseJSON(
      issued,
      v.object({
        user_code: v.string(),
        device_code: v.string(),
        verification_uri: v.string(),
        verification_uri_complete: v.string()
      })
    )
    expect(authorization.verification_uri).toBe('https://cloud.example.com/auth/device')
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
    const tokenBody = await responseJSON(
      token,
      v.object({ access_token: v.string(), token_type: v.string() })
    )
    expect(tokenBody.token_type).toBe('Bearer')
    expect(typeof tokenBody.access_token).toBe('string')
    const stored = await fixture.database
      .selectFrom('session')
      .select(['userId', 'expiresAt'])
      .where('token', '=', tokenBody.access_token)
      .executeTakeFirst()
    expect(stored?.userId).toBe(user.userId)
    expect(new Date(stored?.expiresAt ?? 0).getTime()).toBeGreaterThan(Date.now())
    const discoveryResponse = await fixture.client['.well-known'].openpencil.$get()
    const discovery = parseCloudDiscovery(await discoveryResponse.json())
    const session = (token: string) =>
      outcome(contractClient(fixture.app, { Authorization: `Bearer ${token}` }).session.session())
    expect(await session(tokenBody.access_token)).toBe('ok')
    expect(await session(crypto.randomUUID())).toMatchObject({ status: 401 })
    await signOutFromCloud(discovery, {
      accessToken: tokenBody.access_token,
      fetch: async (input, init) => fixture.app.fetch(new Request(input, init))
    })
    expect(await session(tokenBody.access_token)).toMatchObject({ status: 401 })
  } finally {
    await fixture.close()
  }
})

test('reopening the desktop sign-in page keeps looking its code up', async () => {
  const fixture = await createAccountAuthenticationFixture()
  try {
    const issued = await fixture.app.fetch(
      accountAuthenticationRequest('/api/auth/device/code', {
        client_id: 'openpencil-desktop:test-connection'
      })
    )
    const { user_code: userCode } = await responseJSON(issued, v.object({ user_code: v.string() }))
    const statuses: number[] = []
    for (let page = 0; page < 10; page++) {
      const lookup = await fixture.app.fetch(
        accountAuthenticationRequest(`/api/auth/device?user_code=${userCode}`)
      )
      statuses.push(lookup.status)
    }
    expect(statuses).toEqual(Array.from({ length: 10 }, () => 200))
  } finally {
    await fixture.close()
  }
})
