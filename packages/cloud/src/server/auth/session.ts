import type { CloudTokenScope } from '#cloud/contract'
import type { CloudAuthAdapter, CloudIdentity } from '#cloud/server/auth/adapter'

/** What an app's access reaches: the one workspace its grant was made for. */
export type CloudAppGrant = {
  clientId: string
  workspaceId: string
}

export type CloudActor = {
  userId: string
  email: string
  name: string
  deploymentRole?: 'user' | 'admin'
  /**
   * How the request proved who it is: a signed-in session, a personal access token, or an app's
   * OAuth access token.
   */
  credential?: 'session' | 'token' | 'app'
  /** What a token may do; a session may do anything its account may. */
  scopes?: readonly CloudTokenScope[]
  /** An app's grant, which reaches one workspace alone. */
  grant?: CloudAppGrant
}

export type CloudIdentityResolver = (request: Request) => Promise<CloudIdentity | null>
export type CloudSessionResolver = (request: Request) => Promise<CloudActor | null>

export function createCloudIdentityResolver(auth: CloudAuthAdapter): CloudIdentityResolver {
  return (request) => auth.resolveIdentity(request.headers)
}

export function createCloudSessionResolver(auth: CloudAuthAdapter): CloudSessionResolver {
  return (request) => auth.resolveSession(request.headers)
}
