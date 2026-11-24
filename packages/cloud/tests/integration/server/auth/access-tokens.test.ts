import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { contractClient, outcome } from '#cloud-tests/helpers/contract'
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
/** The contract's client, signed in with `token`. */
const byToken = (token: string) => contractClient(fixture.app, withToken(token).headers)
/** The contract's client, signed in with the session `cookie`. */
const byCookie = (cookie: string) => contractClient(fixture.app, withCookie(cookie).headers)

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
    expect(
      await outcome(
        byToken(token).workspaces.create({
          body: { name: 'Examples', slug: 'examples-by-token' }
        })
      )
    ).toBe('ok')
    const workspaces = await byCookie(person.sessionCookie).workspaces.list()
    expect(JSON.stringify(workspaces)).toContain('examples-by-token')
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
      await outcome(
        byToken(token).session.servicesToken({ body: { workspaceId: crypto.randomUUID() } })
      )
    ).toMatchObject({ status: 401 })
    expect(await outcome(byToken(token).session.session())).toBe('ok')
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
    expect(await outcome(byToken(revoked.token).workspaces.list())).toMatchObject({ status: 401 })

    const expired = await createToken()
    await fixture.database
      .updateTable('apikey')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where('id', '=', expired.accessToken.id)
      .execute()
    expect(await outcome(byToken(expired.token).workspaces.list())).toMatchObject({ status: 401 })

    const banned = await createToken()
    await fixture.database
      .updateTable('user')
      .set({ banned: true })
      .where('id', '=', person.userId)
      .execute()
    try {
      expect(await outcome(byToken(banned.token).workspaces.list())).toMatchObject({
        status: 401
      })
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

    expect(await outcome(byToken(token).workspaces.list())).toMatchObject({ status: 401 })
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
