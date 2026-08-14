import type { CloudAuth } from '#cloud/server/auth'

export type CloudActor = {
  userId: string
  email: string
  name: string
}

export type CloudSessionResolver = (request: Request) => Promise<CloudActor | null>

export function createCloudSessionResolver(auth: CloudAuth): CloudSessionResolver {
  return async (request) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return null
    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name
    }
  }
}
