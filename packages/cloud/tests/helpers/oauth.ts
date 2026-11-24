import { expect } from 'bun:test'

import {
  accountAuthenticationRequest,
  type createAccountAuthenticationFixture
} from '#cloud-tests/helpers/account-authentication'
import { responseJSON } from '#cloud-tests/helpers/response'
import { cloudOAuthDecisionResponseSchema, type CloudOAuthDecision } from '#cloud/contract'
import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

type Fixture = Awaited<ReturnType<typeof createAccountAuthenticationFixture>>

/** Where the test app's authorization codes go. */
export const OAUTH_CALLBACK = 'https://app.example.com/callback'

const registrationSchema = v.object({ client_id: v.string() })
export const oauthTokenSchema = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  scope: v.string()
})

export async function pkce() {
  const verifier = fromUint8Array(crypto.getRandomValues(new Uint8Array(32)), true)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: fromUint8Array(new Uint8Array(digest), true) }
}

/**
 * An app's side of OAuth against a test server: registering, the authorization request, the
 * person's decision on the approval page, and the token exchange.
 */
export function oauthTestApp(fixture: Fixture, publicURL: string) {
  const send = (path: string, init: { body?: object; cookie?: string; token?: string } = {}) =>
    fixture.app.fetch(
      accountAuthenticationRequest(path, init.body, init.cookie, {
        headers: init.token ? { Authorization: `Bearer ${init.token}` } : {}
      })
    )

  async function register(redirect = OAUTH_CALLBACK) {
    const response = await send('/api/auth/oauth2/register', {
      body: {
        client_name: 'Example app',
        redirect_uris: [redirect],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code']
      }
    })
    expect(response.status).toBe(201)
    return (await responseJSON(response, registrationSchema)).client_id
  }

  /** Where the authorization endpoint sends the browser, as a path and query on this server. */
  async function authorize(request: {
    clientId: string
    challenge: string
    resource: string
    cookie?: string
    redirect?: string
  }) {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: request.clientId,
      redirect_uri: request.redirect ?? OAUTH_CALLBACK,
      scope: 'documents:read documents:write offline_access',
      state: 'kept',
      code_challenge: request.challenge,
      code_challenge_method: 'S256',
      resource: request.resource
    })
    const response = await send(`/api/auth/oauth2/authorize?${query}`, { cookie: request.cookie })
    const location = response.headers.get('location')
    if (!location) throw new Error(`Authorization did not redirect: ${response.status}`)
    return new URL(location, publicURL)
  }

  async function decide(cookie: string, decision: CloudOAuthDecision) {
    const response = await send('/api/oauth/decision', { body: decision, cookie })
    expect(response.status).toBe(200)
    return new URL((await responseJSON(response, cloudOAuthDecisionResponseSchema)).redirect)
  }

  const redeem = (request: {
    clientId: string
    code: string
    verifier: string
    resource: string
    redirect?: string
  }) =>
    fixture.app.fetch(
      new Request(new URL('/api/auth/oauth2/token', publicURL), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: request.code,
          redirect_uri: request.redirect ?? OAUTH_CALLBACK,
          client_id: request.clientId,
          code_verifier: request.verifier,
          resource: request.resource
        })
      })
    )

  async function exchange(request: Parameters<typeof redeem>[0]) {
    const response = await redeem(request)
    expect(response.status).toBe(200)
    return responseJSON(response, oauthTokenSchema)
  }

  /** An authorization code for a workspace the person picks, with its verifier. */
  async function approve(request: {
    clientId: string
    cookie: string
    workspaceId: string
    resource: string
    redirect?: string
  }) {
    const { verifier, challenge } = await pkce()
    const page = await authorize({ ...request, challenge })
    const redirect = await decide(request.cookie, {
      decision: 'allow',
      query: page.search.slice(1),
      workspaceId: request.workspaceId
    })
    const code = redirect.searchParams.get('code')
    if (!code) throw new Error('No code')
    return { code, verifier }
  }

  /** An app's tokens once the person approved it for a workspace. */
  async function connect(request: Parameters<typeof approve>[0]) {
    const { code, verifier } = await approve(request)
    return exchange({ ...request, code, verifier })
  }

  return { send, register, authorize, decide, redeem, exchange, approve, connect }
}
