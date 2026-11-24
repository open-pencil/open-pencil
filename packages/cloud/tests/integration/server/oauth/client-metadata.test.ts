import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test
} from 'bun:test'

import {
  accountAuthenticationConfig,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { contractClient } from '#cloud-tests/helpers/contract'
import { OAUTH_CALLBACK, oauthTestApp, pkce } from '#cloud-tests/helpers/oauth'
import { responseJSON } from '#cloud-tests/helpers/response'
import { cloudMCPResource, cloudOAuthRequestResponseSchema } from '#cloud/contract'
import { createBetterAuthAdapter, parseCloudServerConfig } from '#cloud/server'
import { CLOUD_RATE_LIMITS, PostgresRateLimitStore } from '#cloud/server/rate-limit'
import * as v from 'valibot'

import { HOUR_MS, MINUTE_MS } from '@open-pencil/std/timing'

const config = parseCloudServerConfig({ ...accountAuthenticationConfig, oauthEnabled: true })
const resource = cloudMCPResource(config.publicURL)
/** The app's client ID: the address of the metadata document it serves. */
const clientId = 'https://agent.example.com/oauth/client.json'

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let oauth: ReturnType<typeof oauthTestApp>
let person: { userId: string; sessionCookie: string }
let workspaceId: string
/** The addresses the server fetched metadata from. */
const fetched: string[] = []

async function fetchMetadata(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : input.toString()
  fetched.push(url)
  if (!url.endsWith('/client.json')) return new Response(null, { status: 404 })
  return Response.json(
    {
      client_id: url,
      client_name: 'Agent',
      redirect_uris: [OAUTH_CALLBACK],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    },
    { headers: { 'Cache-Control': 'max-age=300' } }
  )
}

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({
    config,
    fetchClientMetadata: fetchMetadata
  })
  oauth = oauthTestApp(fixture, config.publicURL)
  person = await createVerifiedCredentialAccount(fixture, {
    email: 'designer@example.com',
    name: 'Designer',
    password: 'designer-password-long-enough',
    approved: true
  })
  const api = contractClient(fixture.app, withCookie(person.sessionCookie).headers)
  workspaceId = (await api.workspaces.create({ body: { name: 'Studio', slug: 'studio' } }))
    .workspace.id
})

afterAll(async () => {
  await fixture.close()
})

describe('apps named by a client metadata document', () => {
  test('are advertised to clients in the authorization server metadata', async () => {
    const metadata = await responseJSON(
      await oauth.send('/.well-known/oauth-authorization-server/api/auth'),
      v.looseObject({ client_id_metadata_document_supported: v.optional(v.boolean()) })
    )
    expect(metadata.client_id_metadata_document_supported).toBe(true)
  })

  test('connect without registering, under the name their document gives', async () => {
    const { verifier, challenge } = await pkce()
    const page = await oauth.authorize({
      clientId,
      challenge,
      resource,
      cookie: person.sessionCookie
    })
    expect(fetched).toContain(clientId)
    const request = await responseJSON(
      await oauth.send(
        `/api/oauth/request?${new URLSearchParams({ query: page.search.slice(1) })}`,
        { cookie: person.sessionCookie }
      ),
      cloudOAuthRequestResponseSchema
    )
    expect(request.request.app.name).toBe('Agent')
    const redirect = await oauth.decide(person.sessionCookie, {
      decision: 'allow',
      query: page.search.slice(1),
      workspaceId
    })
    const code = redirect.searchParams.get('code')
    if (!code) throw new Error('No code')
    const tokens = await oauth.exchange({ clientId, code, verifier, resource })
    const session = await oauth.send('/api/session', { token: tokens.access_token })
    expect(session.status).toBe(200)
  })

  test('are refused when their document cannot be fetched', async () => {
    const { challenge } = await pkce()
    await expect(
      oauth.authorize({
        clientId: 'https://agent.example.com/missing.json',
        challenge,
        resource,
        cookie: person.sessionCookie
      })
    ).rejects.toThrow()
  })

  describe('fetches', () => {
    // Held within one budget window, whenever the test runs.
    beforeEach(() => {
      setSystemTime(Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS + 1000)
    })
    afterEach(() => {
      setSystemTime()
    })

    /** The app's authorization through an adapter of its own, as a Worker makes one per request. */
    async function authorizeAfresh(id: string) {
      const fresh = createBetterAuthAdapter(config, fixture.database, undefined, {
        fetchClientMetadata: fetchMetadata
      })
      const { challenge } = await pkce()
      const response = await fresh.handler(
        new Request(
          `${config.publicURL}/api/auth/oauth2/authorize?${new URLSearchParams({
            client_id: id,
            redirect_uri: OAUTH_CALLBACK,
            response_type: 'code',
            scope: 'documents:read',
            code_challenge: challenge,
            code_challenge_method: 'S256',
            resource
          })}`
        )
      )
      return response.headers.get('location')?.includes('/auth/authorize') ?? false
    }
    const spend = (site: string) =>
      Promise.all(
        Array.from({ length: CLOUD_RATE_LIMITS.clientMetadata.siteLimit }, () =>
          new PostgresRateLimitStore(fixture.database, config.authSecret, 'client-metadata', {
            windowMs: CLOUD_RATE_LIMITS.clientMetadata.windowMs
          }).increment(`site:${site}`)
        )
      )
    const age = (id: string, ms: number) =>
      fixture.database
        .updateTable('oauthClient')
        .set({ updatedAt: new Date(Date.now() - ms) })
        .where('clientId', '=', id)
        .execute()

    test('happen once for apps just fetched, whichever instance asks, and again later', async () => {
      const id = 'https://once.example.com/client.json'
      expect(await authorizeAfresh(id)).toBe(true)
      expect(await authorizeAfresh(id)).toBe(true)
      expect(fetched.filter((url) => url === id)).toHaveLength(1)
      await age(id, 6 * MINUTE_MS)
      expect(await authorizeAfresh(id)).toBe(true)
      expect(await authorizeAfresh(id)).toBe(true)
      expect(fetched.filter((url) => url === id)).toHaveLength(2)
    })

    test('stop at a site’s budget, which instances share; known apps go on for a day', async () => {
      const known = 'https://busy.example.com/client.json'
      const unknown = 'https://busy.example.com/other/client.json'
      expect(await authorizeAfresh(known)).toBe(true)
      await age(known, HOUR_MS)
      await spend('https://busy.example.com')
      const before = fetched.length
      expect(await authorizeAfresh(known)).toBe(true)
      expect(await authorizeAfresh(unknown)).toBe(false)
      await age(known, 25 * HOUR_MS)
      expect(await authorizeAfresh(known)).toBe(false)
      expect(fetched).toHaveLength(before)
      expect(await authorizeAfresh('https://quiet.example.com/client.json')).toBe(true)
    })
  })
})
