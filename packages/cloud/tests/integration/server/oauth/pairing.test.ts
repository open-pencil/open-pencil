import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  createAccountAuthenticationFixture
} from '#cloud-tests/helpers/account-authentication'
import { OAUTH_CALLBACK, oauthTestApp, pkce } from '#cloud-tests/helpers/oauth'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  cloudAgentPairingRequestResponseSchema,
  cloudAPIResource,
  cloudMCPResource,
  cloudOAuthDecisionResponseSchema,
  type CloudAgentPairingDecision
} from '#cloud/contract'
import { parseCloudServerConfig } from '#cloud/server'
import * as v from 'valibot'

const config = parseCloudServerConfig({
  ...accountAuthenticationConfig,
  oauthEnabled: true,
  agentPairing: true
})
const resource = cloudMCPResource(config.publicURL)
const token = `opg_${'3c'.repeat(32)}`
const tokenAnswerSchema = v.object({
  access_token: v.string(),
  token_type: v.string(),
  scope: v.string()
})

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let oauth: ReturnType<typeof oauthTestApp>
let clientId: string

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({
    config,
    services: { callPairedTool: async () => ({ ok: false, failure: 'editor_not_open' }) }
  })
  oauth = oauthTestApp(fixture, config.publicURL)
  clientId = await oauth.register()
})

afterAll(async () => {
  await fixture.close()
})

const decide = (decision: CloudAgentPairingDecision) =>
  oauth.send('/api/agent-pairing/decision', { body: decision })

/** A signed-out browser's request as the pairing page has it, with the agent's verifier. */
async function arrive(target = resource) {
  const { verifier, challenge } = await pkce()
  const page = await oauth.authorize({ clientId, challenge, resource: target })
  return { verifier, query: page.search.slice(1) }
}

async function approved() {
  const { verifier, query } = await arrive()
  const answer = await decide({ decision: 'allow', query, token })
  expect(answer.status).toBe(200)
  const redirect = new URL((await responseJSON(answer, cloudOAuthDecisionResponseSchema)).redirect)
  const code = redirect.searchParams.get('code')
  if (!code) throw new Error('No code')
  return { redirect, verifier, code }
}

describe('pairing an agent through its sign-in, without an account', () => {
  test('shows who asks, returns with a code, and gives the agent the token once', async () => {
    const { query } = await arrive()
    const shown = await responseJSON(
      await oauth.send(`/api/agent-pairing/request?${new URLSearchParams({ query })}`),
      cloudAgentPairingRequestResponseSchema
    )
    expect(shown.request).toMatchObject({
      app: { name: 'Example app' },
      returnsTo: new URL(OAUTH_CALLBACK).host
    })
    const { redirect, verifier, code } = await approved()
    expect(redirect.origin + redirect.pathname).toBe(OAUTH_CALLBACK)
    expect(redirect.searchParams.get('state')).toBe('kept')
    expect(redirect.searchParams.get('iss')).toBe(`${config.publicURL}/api/auth`)
    const exchanged = await oauth.redeem({ clientId, code, verifier, resource })
    expect(exchanged.headers.get('cache-control')).toBe('no-store')
    expect(await responseJSON(exchanged, tokenAnswerSchema)).toEqual({
      access_token: token,
      token_type: 'Bearer',
      scope: 'documents:read documents:write'
    })
    expect((await oauth.redeem({ clientId, code, verifier, resource })).status).toBe(400)
    const users = await fixture.database.selectFrom('user').select('id').execute()
    expect(users).toEqual([])
  })

  test('keeps nothing readable while the code waits', async () => {
    await approved()
    const rows = await fixture.database.selectFrom('verification').selectAll().execute()
    expect(rows.length).toBeGreaterThan(0)
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  test('refuses another verifier, app, return address, or resource, and spends the code', async () => {
    const wrong = [
      { verifier: (await pkce()).verifier },
      { clientId: 'someone-else' },
      { redirect: 'https://evil.example.com/callback' },
      { resource: cloudAPIResource(config.publicURL) }
    ]
    for (const changed of wrong) {
      const { verifier, code } = await approved()
      const request = { clientId, code, verifier, resource }
      expect((await oauth.redeem({ ...request, ...changed })).status).toBe(400)
      expect((await oauth.redeem(request)).status).toBe(400)
    }
  })

  test('refuses an expired code', async () => {
    const { verifier, code } = await approved()
    await fixture.database
      .updateTable('verification')
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute()
    expect((await oauth.redeem({ clientId, code, verifier, resource })).status).toBe(400)
  })

  test('refuses a query the server did not sign, or one for the document API', async () => {
    const { query } = await arrive()
    const moved = new URLSearchParams(query)
    moved.set('redirect_uri', 'https://evil.example.com/callback')
    expect((await decide({ decision: 'allow', query: moved.toString(), token })).status).toBe(400)
    const api = await arrive(cloudAPIResource(config.publicURL))
    expect((await decide({ decision: 'allow', query: api.query, token })).status).toBe(400)
  })

  test('refuses an app that has a secret to prove', async () => {
    const { query } = await arrive()
    await fixture.database
      .updateTable('oauthClient')
      .set({ tokenEndpointAuthMethod: 'client_secret_post' })
      .where('clientId', '=', clientId)
      .execute()
    expect((await decide({ decision: 'allow', query, token })).status).toBe(400)
    await fixture.database
      .updateTable('oauthClient')
      .set({ tokenEndpointAuthMethod: 'none' })
      .where('clientId', '=', clientId)
      .execute()
  })

  test('returns a refusal to the agent', async () => {
    const { query } = await arrive()
    const answer = await responseJSON(
      await decide({ decision: 'deny', query }),
      cloudOAuthDecisionResponseSchema
    )
    expect(new URL(answer.redirect).searchParams.get('error')).toBe('access_denied')
  })
})
