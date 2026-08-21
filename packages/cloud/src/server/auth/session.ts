import type { CloudAuthAdapter } from '#cloud/server/auth/adapter'

export type CloudActor = {
  userId: string
  email: string
  name: string
}

export type CloudSessionResolver = (request: Request) => Promise<CloudActor | null>

export function createCloudSessionResolver(auth: CloudAuthAdapter): CloudSessionResolver {
  return (request) => auth.resolveSession(request.headers)
}
