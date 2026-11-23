import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  accountAuthenticationConfig,
  accountAuthenticationRequest,
  createAccountAuthenticationFixture,
  createVerifiedCredentialAccount,
  withCookie
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import {
  CLOUD_APP_ACCESS_TOKEN_PREFIX,
  CLOUD_APP_REFRESH_TOKEN_PREFIX,
  cloudAPIResource,
  cloudAppConnectionsResponseSchema,
  cloudOAuthDecisionResponseSchema,
  cloudOAuthRequestResponseSchema,
  type CloudOAuthDecision
} from '#cloud/contract'
import { parseCloudServerConfig } from '#cloud/server'
import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

const config = parseCloudServerConfig({ ...accountAuthenticationConfig, oauthEnabled: true })
const resource = cloudAPIResource(config.publicURL)
const callback = 'https://app.example.com/callback'

const registrationSchema = v.object({ client_id: v.string() })
const tokenSchema = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  scope: v.string()
})
const workspaceSchema = v.object({ workspace: v.object({ id: v.string() }) })
const workspacesSchema = v.object({ workspaces: v.array(v.object({ id: v.string() })) })

let fixture: Awaited<ReturnType<typeof createAccountAuthenticationFixture>>
let person: { userId: string; sessionCookie: string }
let granted: string
let other: string
/** One app for the whole file: registration is rate-limited per address, as for any app. */
let app: string

const send = (path: string, init: { body?: object; cookie?: string; token?: string } = {}) =>
  fixture.app.fetch(
    accountAuthenticationRequest(path, init.body, init.cookie, {
      headers: init.token ? { Authorization: `Bearer ${init.token}` } : {}
    })
  )

async function workspace(slug: string) {
  const response = await fixture.client.api.workspaces.$post(
    { json: { name: slug, slug } },
    withCookie(person.sessionCookie)
  )
  return (await responseJSON(response, workspaceSchema)).workspace.id
}

async function pkce() {
  const verifier = fromUint8Array(crypto.getRandomValues(new Uint8Array(32)), true)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: fromUint8Array(new Uint8Array(digest), true) }
}

async function register() {
  const response = await send('/api/auth/oauth2/register', {
    body: {
      client_name: 'Example app',
      redirect_uris: [callback],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    }
  })
  expect(response.status).toBe(201)
  return (await responseJSON(response, registrationSchema)).client_id
}

/** Where the authorization endpoint sends the browser, as a path and query on this server. */
async function authorize(clientId: string, challenge: string, cookie?: string) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callback,
    scope: 'documents:read documents:write offline_access',
    state: 'kept',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource
  })
  const response = await send(`/api/auth/oauth2/authorize?${query}`, { cookie })
  const location = response.headers.get('location')
  if (!location) throw new Error(`Authorization did not redirect: ${response.status}`)
  return new URL(location, config.publicURL)
}

async function decide(decision: CloudOAuthDecision) {
  const response = await send('/api/oauth/decision', {
    body: decision,
    cookie: person.sessionCookie
  })
  expect(response.status).toBe(200)
  return new URL((await responseJSON(response, cloudOAuthDecisionResponseSchema)).redirect)
}

async function exchange(clientId: string, code: string, verifier: string) {
  const response = await fixture.app.fetch(
    new Request(new URL('/api/auth/oauth2/token', config.publicURL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callback,
        client_id: clientId,
        code_verifier: verifier,
        resource
      })
    })
  )
  expect(response.status).toBe(200)
  return responseJSON(response, tokenSchema)
}

/** An authorization code for the granted workspace, with the verifier that redeems it. */
async function approve() {
  const { verifier, challenge } = await pkce()
  const page = await authorize(app, challenge, person.sessionCookie)
  const redirect = await decide({
    decision: 'allow',
    query: page.search.slice(1),
    workspaceId: granted
  })
  const code = redirect.searchParams.get('code')
  if (!code) throw new Error('No code')
  return { code, verifier }
}

async function connections() {
  const response = await send('/api/account/connections', { cookie: person.sessionCookie })
  return (await responseJSON(response, cloudAppConnectionsResponseSchema)).connections
}

/** Connects a new app to the granted workspace, as a person does on the approval page. */
async function connect() {
  const { code, verifier } = await approve()
  return { clientId: app, tokens: await exchange(app, code, verifier) }
}

beforeAll(async () => {
  fixture = await createAccountAuthenticationFixture({ config })
  person = await createVerifiedCredentialAccount(fixture, {
    email: 'designer@example.com',
    name: 'Designer',
    password: 'designer-password-long-enough',
    approved: true
  })
  granted = await workspace('granted')
  other = await workspace('other')
  app = await register()
})

afterAll(async () => {
  await fixture.close()
})

describe('OAuth discovery', () => {
  test('names the document API and its authorization server', async () => {
    const metadata = await responseJSON(
      await send('/.well-known/oauth-protected-resource/api'),
      v.object({ resource: v.string(), authorization_servers: v.array(v.string()) })
    )
    expect(metadata.resource).toBe(resource)
    const server = await responseJSON(
      await send(
        `/.well-known/oauth-authorization-server${new URL(metadata.authorization_servers[0] ?? '').pathname}`
      ),
      v.looseObject({
        issuer: v.string(),
        registration_endpoint: v.string(),
        code_challenge_methods_supported: v.array(v.string()),
        scopes_supported: v.array(v.string())
      })
    )
    expect(server.issuer).toBe(metadata.authorization_servers[0] ?? '')
    expect(server.code_challenge_methods_supported).toEqual(['S256'])
    expect(server.scopes_supported).toContain('documents:write')
    expect(server).not.toHaveProperty('introspection_endpoint')
  })

  test('registers a desktop app that listens on a loopback address', async () => {
    const response = await send('/api/auth/oauth2/register', {
      body: {
        client_name: 'Desktop app',
        redirect_uris: ['http://127.0.0.1:8976/callback', 'http://localhost:8976/callback'],
        token_endpoint_auth_method: 'none'
      }
    })
    expect(response.status).toBe(201)
    const registered = await responseJSON(
      response,
      v.object({ application_type: v.string(), redirect_uris: v.array(v.string()) })
    )
    expect(registered.application_type).toBe('native')
  })

  test('points a request without a token to the resource metadata', async () => {
    const response = await send('/api/workspaces')
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain(
      '/.well-known/oauth-protected-resource/api'
    )
  })
})

describe('connecting an app', () => {
  test('asks a signed-out person to sign in on the approval page', async () => {
    const page = await authorize(app, (await pkce()).challenge)
    expect(page.pathname).toBe('/auth/authorize')
    expect(page.searchParams.get('sig')).not.toBeNull()
  })

  test('shows the app, its scopes, and the workspaces to pick from', async () => {
    const page = await authorize(app, (await pkce()).challenge, person.sessionCookie)
    expect(page.pathname).toBe('/auth/authorize')
    const { request } = await responseJSON(
      await send(`/api/oauth/request?${new URLSearchParams({ query: page.search.slice(1) })}`, {
        cookie: person.sessionCookie
      }),
      cloudOAuthRequestResponseSchema
    )
    expect(request.app.name).toBe('Example app')
    expect(request.scopes).toEqual(['documents:read', 'documents:write'])
    expect(request.offline).toBe(true)
    expect(request.workspaces.map((each) => each.id).toSorted()).toEqual(
      [granted, other].toSorted()
    )
  })

  test('refuses a request whose signature does not match', async () => {
    const page = await authorize(app, (await pkce()).challenge, person.sessionCookie)
    const tampered = page.search.slice(1).replace('documents%3Aread', 'documents%3Awrite')
    const response = await send(`/api/oauth/request?${new URLSearchParams({ query: tampered })}`, {
      cookie: person.sessionCookie
    })
    expect(response.status).toBe(400)
  })

  test('returns a refusal to the app', async () => {
    const page = await authorize(app, (await pkce()).challenge, person.sessionCookie)
    const redirect = await decide({ decision: 'deny', query: page.search.slice(1) })
    expect(redirect.origin + redirect.pathname).toBe(callback)
    expect(redirect.searchParams.get('error')).toBe('access_denied')
    expect(redirect.searchParams.get('state')).toBe('kept')
  })

  test('gives the app tokens that reach the picked workspace alone', async () => {
    const { tokens } = await connect()
    expect(tokens.access_token.startsWith(CLOUD_APP_ACCESS_TOKEN_PREFIX)).toBe(true)
    expect(tokens.refresh_token.startsWith(CLOUD_APP_REFRESH_TOKEN_PREFIX)).toBe(true)
    const token = tokens.access_token

    const listed = await responseJSON(await send('/api/workspaces', { token }), workspacesSchema)
    expect(listed.workspaces.map((each) => each.id)).toEqual([granted])
    expect((await send(`/api/workspaces/${granted}/documents`, { token })).status).toBe(200)
    expect((await send(`/api/workspaces/${other}/documents`, { token })).status).toBe(404)
    expect((await send('/api/session', { token })).status).toBe(200)
    // Apps work on documents: they never make workspaces, share, or manage people.
    expect(
      (await send('/api/workspaces', { token, body: { name: 'More', slug: 'more-by-app' } })).status
    ).toBe(403)
    expect((await send(`/api/workspaces/${granted}/members`, { token })).status).toBe(403)
    expect((await send('/api/shared-documents', { token })).status).toBe(403)
    const created = await responseJSON(
      await send(`/api/workspaces/${granted}/documents`, { token, body: { name: 'By app' } }),
      v.object({ document: v.object({ id: v.string() }) })
    )
    for (const list of ['shares', 'grants', 'invitations']) {
      expect((await send(`/api/documents/${created.document.id}/${list}`, { token })).status).toBe(
        403
      )
    }
    expect((await send('/api/account/tokens', { token })).status).toBe(401)
  })

  test('remembers the approval, so connecting again needs only the workspace', async () => {
    const first = await connect()
    const { challenge } = await pkce()
    const page = await authorize(first.clientId, challenge, person.sessionCookie)
    const redirect = await decide({
      decision: 'allow',
      query: page.search.slice(1),
      workspaceId: granted
    })
    expect(redirect.searchParams.get('code')).not.toBeNull()
  })

  test('answers one request of a session at a time', async () => {
    const page = await authorize(app, (await pkce()).challenge, person.sessionCookie)
    const session = await fixture.database
      .selectFrom('session')
      .select('id')
      .where('userId', '=', person.userId)
      .executeTakeFirstOrThrow()
    // Another request of the same session is between its pick and its code.
    await fixture.database
      .insertInto('oauthWorkspaceChoice')
      .values({
        sessionId: session.id,
        userId: person.userId,
        workspaceId: other,
        chosenAt: new Date()
      })
      .execute()
    const response = await send('/api/oauth/decision', {
      body: { decision: 'allow', query: page.search.slice(1), workspaceId: granted },
      cookie: person.sessionCookie
    })
    expect(response.status).toBe(409)
    // The other request's pick stays its own.
    const kept = await fixture.database
      .selectFrom('oauthWorkspaceChoice')
      .select('workspaceId')
      .where('sessionId', '=', session.id)
      .executeTakeFirst()
    expect(kept?.workspaceId).toBe(other)
    await fixture.database
      .deleteFrom('oauthWorkspaceChoice')
      .where('sessionId', '=', session.id)
      .execute()
  })

  test('refuses a workspace the person is not in', async () => {
    const page = await authorize(app, (await pkce()).challenge, person.sessionCookie)
    const response = await send('/api/oauth/decision', {
      body: { decision: 'allow', query: page.search.slice(1), workspaceId: crypto.randomUUID() },
      cookie: person.sessionCookie
    })
    expect(response.status).toBe(404)
  })
})

describe('connected apps', () => {
  test('stay connected through a refresh and stop once disconnected', async () => {
    const { clientId, tokens } = await connect()
    const refreshed = await fixture.app.fetch(
      new Request(new URL('/api/auth/oauth2/token', config.publicURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: clientId,
          resource
        })
      })
    )
    expect(refreshed.status).toBe(200)
    const token = (await responseJSON(refreshed, tokenSchema)).access_token
    expect((await send('/api/workspaces', { token })).status).toBe(200)

    const connection = (await connections()).find((each) => each.app.clientId === clientId)
    expect(connection?.workspace.id).toBe(granted)
    expect(connection?.scopes).toEqual(['documents:read', 'documents:write'])

    const revoked = await send('/api/account/connections/revoke', {
      body: { id: connection?.id },
      cookie: person.sessionCookie
    })
    expect(revoked.status).toBe(200)
    expect((await send('/api/workspaces', { token })).status).toBe(401)
  })

  test('stop working from a code issued before disconnecting', async () => {
    await connect()
    const { code, verifier } = await approve()
    for (const connection of await connections()) {
      await send('/api/account/connections/revoke', {
        body: { id: connection.id },
        cookie: person.sessionCookie
      })
    }
    const late = await exchange(app, code, verifier)
    expect((await send('/api/session', { token: late.access_token })).status).toBe(401)
  })

  test('stop reaching a workspace the person left', async () => {
    const { tokens } = await connect()
    await fixture.database
      .deleteFrom('workspaceMember')
      .where('workspaceId', '=', granted)
      .where('userId', '=', person.userId)
      .execute()
    expect((await send('/api/session', { token: tokens.access_token })).status).toBe(401)
  })
})
