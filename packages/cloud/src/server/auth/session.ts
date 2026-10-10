import type { CloudAuthAdapter, CloudIdentity } from '#cloud/server/auth/adapter'

export type CloudActor = {
  userId: string
  email: string
  name: string
  deploymentRole?: 'user' | 'admin'
}

export type CloudIdentityResolver = (request: Request) => Promise<CloudIdentity | null>
export type CloudSessionResolver = (request: Request) => Promise<CloudActor | null>

export function createCloudIdentityResolver(auth: CloudAuthAdapter): CloudIdentityResolver {
  return (request) => auth.resolveIdentity(request.headers)
}

export function createCloudSessionResolver(auth: CloudAuthAdapter): CloudSessionResolver {
  return (request) => auth.resolveSession(request.headers)
}
