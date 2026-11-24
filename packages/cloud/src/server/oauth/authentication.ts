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

/**
 * Prepares a request for the OAuth provider: an authorization request from a person whose
 * session may not use the server yet, such as one waiting for its second step or for approval,
 * goes on as if signed out. The approval page then sends them through signing in, and the
 * provider never issues a code for such a session.
 */
export function providerRequest(
  endpoints: { oauth2Authorize: { path: string } },
  served: (endpointPath: string) => string,
  active: (headers: Headers) => Promise<unknown>
) {
  const authorize = served(endpoints.oauth2Authorize.path)
  return async (request: Request): Promise<Request> => {
    if (new URL(request.url).pathname !== authorize) return request
    if (await active(request.headers)) return request
    const headers = new Headers(request.headers)
    headers.delete('cookie')
    headers.delete('authorization')
    return new Request(request, { headers })
  }
}
