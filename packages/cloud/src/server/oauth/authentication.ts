import type { CloudOAuthAuthentication } from '#cloud/server/auth/adapter'
import { omitBy } from 'es-toolkit'
import * as v from 'valibot'

import { OAuthRequestError, type ProviderRedirect } from './service'

/** The OAuth provider's endpoints inside Better Auth that Cloud's approval routes call. */
type ProviderAPI = {
  oauth2Continue(input: {
    request: Request
    headers: Headers
    body: { postLogin: true; oauth_query: string }
    asResponse: false
  }): Promise<unknown>
  oauth2Consent(input: {
    request: Request
    headers: Headers
    body: { accept: boolean; oauth_query: string }
    asResponse: false
  }): Promise<unknown>
  getOAuthServerConfig(): Promise<unknown>
}

const redirectSchema = v.object({ url: v.string() })

/** Where the provider sends the browser next, as its endpoints answer a server call. */
function redirectOf(answer: unknown): ProviderRedirect {
  const parsed = v.safeParse(redirectSchema, answer)
  if (!parsed.success) throw new OAuthRequestError('invalid_request')
  return parsed.output
}

/** The approval routes' side of Better Auth's OAuth provider. */
export function cloudOAuthAuthentication(api: ProviderAPI): CloudOAuthAuthentication {
  return {
    steps: {
      continue: async (request, query) =>
        redirectOf(
          await api.oauth2Continue({
            request,
            headers: request.headers,
            body: { postLogin: true, oauth_query: query },
            asResponse: false
          })
        ),
      consent: async (request, query, accept) =>
        redirectOf(
          await api.oauth2Consent({
            request,
            headers: request.headers,
            body: { accept, oauth_query: query },
            asResponse: false
          })
        )
    },
    // Introspection stays closed (`closedOAuthPaths`), so the metadata does not offer it.
    serverMetadata: async () => {
      const metadata = v.parse(v.record(v.string(), v.unknown()), await api.getOAuthServerConfig())
      return omitBy(metadata, (_value, key) => key.startsWith('introspection_'))
    }
  }
}

const registrationSchema = v.looseObject({
  redirect_uris: v.array(v.string()),
  application_type: v.optional(v.string())
})

/** The redirect hosts RFC 8252 lets a native app listen on over plain HTTP. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const isLoopbackRedirect = (uri: string) => {
  const url = URL.parse(uri)
  return url?.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
}

/**
 * A registration that names no `application_type` and redirects to loopback HTTP alone is a
 * native app's, as MCP clients derive it (SEP-837); the provider would take it as a web app's,
 * which must redirect over HTTPS, and refuse the desktop clients that predate that derivation.
 */
async function withNativeApplicationType(request: Request): Promise<Request> {
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), registrationSchema),
    await request.clone().text()
  )
  if (!parsed.success) return request
  const registration = parsed.output
  if (
    registration.application_type !== undefined ||
    registration.redirect_uris.length === 0 ||
    !registration.redirect_uris.every(isLoopbackRedirect)
  ) {
    return request
  }
  return new Request(request, {
    method: 'POST',
    body: JSON.stringify({ ...registration, application_type: 'native' })
  })
}

/**
 * Prepares a request for the OAuth provider:
 *
 * - An authorization request from a person whose session may not use the server yet, such as one
 *   waiting for its second step or for approval, goes on as if signed out: the approval page then
 *   sends them through signing in, and the provider never issues a code for such a session.
 * - A registration gets the application type its loopback redirects imply.
 */
export function providerRequest(
  endpoints: { oauth2Authorize: { path: string }; registerOAuthClient: { path: string } },
  served: (endpointPath: string) => string,
  active: (headers: Headers) => Promise<unknown>
) {
  const authorize = served(endpoints.oauth2Authorize.path)
  const register = served(endpoints.registerOAuthClient.path)
  return async (request: Request): Promise<Request> => {
    const path = new URL(request.url).pathname
    if (path === register && request.method === 'POST') return withNativeApplicationType(request)
    if (path !== authorize) return request
    if (await active(request.headers)) return request
    const headers = new Headers(request.headers)
    headers.delete('cookie')
    headers.delete('authorization')
    return new Request(request, { headers })
  }
}
