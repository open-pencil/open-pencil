import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { OAUTH_CALLBACK, oauthTestApp, pkce } from '#cloud-tests/helpers/oauth'
import { responseJSON } from '#cloud-tests/helpers/response'
import { cloudMCPResource, cloudOAuthRequestResponseSchema } from '#cloud/contract'
import { parseCloudServerConfig } from '#cloud/server'
import * as v from 'valibot'

const config = parseCloudServerConfig({ ...accountAuthenticationConfig, oauthEnabled: true })
const resource = cloudMCPResource(config.publicURL)
/** The app's client ID: the address of the metadata document it serves. */
const clientId = 'https://agent.example.com/oauth/client.json'

const workspaceSchema = v.object({ workspace: v.object({ id: v.string() }) })

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let oauth: ReturnType<typeof oauthTestApp>
let person: { userId: string; sessionCookie: string }
let workspaceId: string
/** The addresses the server fetched metadata from. */
const fetched: string[] = []

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({
    config,
    async fetchClientMetadata(input) {
      const url = input instanceof Request ? input.url : input.toString()
      fetched.push(url)
      if (url !== clientId) return new Response(null, { status: 404 })
      return Response.json(
        {
          client_id: clientId,
          client_name: 'Agent',
          redirect_uris: [OAUTH_CALLBACK],
          token_endpoint_auth_method: 'none',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code']
        },
        { headers: { 'Cache-Control': 'max-age=300' } }
      )
    }
  })
  oauth = oauthTestApp(fixture, config.publicURL)
  person = await createVerifiedCredentialAccount(fixture, {
    email: 'designer@example.com',
    name: 'Designer',
    password: 'designer-password-long-enough',
    approved: true
  })
  const created = await fixture.client.api.workspaces.$post(
    { json: { name: 'Studio', slug: 'studio' } },
    withCookie(person.sessionCookie)
  )
  workspaceId = (await responseJSON(created, workspaceSchema)).workspace.id
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
})
