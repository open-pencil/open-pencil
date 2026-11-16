import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_ACCESS_TOKEN_PREFIX,
  cloudAccessTokenCreatedResponseSchema,
  cloudAccessTokensResponseSchema
} from '#cloud/contract'

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let person: { userId: string; sessionCookie: string }

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture()
  person = await createVerifiedCredentialAccount(fixture, {
    email: 'publisher@example.com',
    name: 'Publisher',
    password: 'publisher-password-long-enough',
    approved: true
  })
})

afterAll(async () => {
  await fixture.close()
})

const send = (path: string, init: { body?: object; cookie?: string; token?: string } = {}) =>
  fixture.app.fetch(
    accountAuthenticationRequest(path, init.body, init.cookie, {
      headers: init.token ? { Authorization: `Bearer ${init.token}` } : {}
    })
  )
const withToken = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

async function createToken(name = 'CI') {
  const response = await fixture.client.api.account.tokens.create.$post(
    { json: { name, expiresInDays: 30 } },
    withCookie(person.sessionCookie)
  )
  expect(response.status).toBe(201)
  return responseJSON(response, cloudAccessTokenCreatedResponseSchema)
}

describe('personal access tokens', () => {
  test('are shown whole once, then listed by their start alone', async () => {
    const created = await createToken('Examples')
    expect(created.token.startsWith(CLOUD_ACCESS_TOKEN_PREFIX)).toBe(true)
    expect(created.accessToken.name).toBe('Examples')
    expect(created.accessToken.expiresAt).not.toBeNull()

    const listed = await responseJSON(
      await fixture.client.api.account.tokens.$get(undefined, withCookie(person.sessionCookie)),
      cloudAccessTokensResponseSchema
    )
    const token = listed.tokens.find((each) => each.id === created.accessToken.id)
    expect(token?.start && created.token.startsWith(token.start)).toBe(true)
    expect(JSON.stringify(listed)).not.toContain(created.token)
  })

  test('act as their account on the document API', async () => {
    const { token } = await createToken()
    const created = await fixture.client.api.workspaces.$post(
      { json: { name: 'Examples', slug: 'examples-by-token' } },
      withToken(token)
    )
    expect(created.status).toBe(201)
    const workspaces = await fixture.client.api.workspaces.$get(
      undefined,
      withCookie(person.sessionCookie)
    )
    expect(await workspaces.text()).toContain('examples-by-token')
  })

  test('never reach account management, administration, or Better Auth', async () => {
    const { token } = await createToken()
    expect((await fixture.client.api.account.tokens.$get(undefined, withToken(token))).status).toBe(
      401
    )
    expect(
      (
        await fixture.client.api.account.tokens.create.$post(
          { json: { name: 'More', expiresInDays: 1 } },
          withToken(token)
        )
      ).status
    ).toBe(401)
    expect(
      (await fixture.client.api.admin.users.$get({ query: {} }, withToken(token))).status
    ).toBe(401)
    // Services tokens spend the account's credits, so they take a session.
    expect(
      (
        await fixture.client.api.services.token.$post(
          { json: { workspaceId: crypto.randomUUID() } },
          withToken(token)
        )
      ).status
    ).toBe(401)
    expect((await fixture.client.api.session.$get(undefined, withToken(token))).status).toBe(200)
    expect((await send('/api/auth/api-key/list', { token })).status).toBe(404)
    expect(
      (
        await send('/api/auth/api-key/create', {
          body: { name: 'Direct' },
          cookie: person.sessionCookie
        })
      ).status
    ).toBe(404)
  })

  test('stop working once revoked, expired, or their account is banned', async () => {
    const revoked = await createToken()
    const revoke = await fixture.client.api.account.tokens.revoke.$post(
      { json: { id: revoked.accessToken.id } },
      withCookie(person.sessionCookie)
    )
    expect(revoke.status).toBe(200)
    expect(
      (await fixture.client.api.workspaces.$get(undefined, withToken(revoked.token))).status
    ).toBe(401)

    const expired = await createToken()
    await fixture.database
      .updateTable('apikey')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where('id', '=', expired.accessToken.id)
      .execute()
    expect(
      (await fixture.client.api.workspaces.$get(undefined, withToken(expired.token))).status
    ).toBe(401)

    const banned = await createToken()
    await fixture.database
      .updateTable('user')
      .set({ banned: true })
      .where('id', '=', person.userId)
      .execute()
    try {
      expect(
        (await fixture.client.api.workspaces.$get(undefined, withToken(banned.token))).status
      ).toBe(401)
    } finally {
      await fixture.database
        .updateTable('user')
        .set({ banned: false })
        .where('id', '=', person.userId)
        .execute()
    }
  })

  test('go with their account', async () => {
    const leaving = await createVerifiedCredentialAccount(fixture, {
      email: 'leaving@example.com',
      name: 'Leaving',
      password: 'leaving-password-long-enough',
      approved: true
    })
    const created = await fixture.client.api.account.tokens.create.$post(
      { json: { name: 'Old CI', expiresInDays: 30 } },
      withCookie(leaving.sessionCookie)
    )
    const { token } = await responseJSON(created, cloudAccessTokenCreatedResponseSchema)
    const deleted = await fixture.client.api.account.delete.$post(
      { json: {} },
      withCookie(leaving.sessionCookie)
    )
    expect(deleted.status).toBe(200)

    expect((await fixture.client.api.workspaces.$get(undefined, withToken(token))).status).toBe(401)
    const left = await fixture.database
      .selectFrom('apikey')
      .select('id')
      .where('referenceId', '=', leaving.userId)
      .execute()
    expect(left).toEqual([])
  })

  test('are made only from a session that signed in recently', async () => {
    await fixture.database
      .updateTable('session')
      .set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where('userId', '=', person.userId)
      .execute()
    const stale = await fixture.client.api.account.tokens.create.$post(
      { json: { name: 'Late', expiresInDays: 30 } },
      withCookie(person.sessionCookie)
    )
    expect(stale.status).toBe(403)
    expect(await stale.text()).toContain('session_not_fresh')
  })
})
