import type { CloudActor } from '#cloud/server/auth/session'

export interface CloudAuthAdapter {
  handler(request: Request): Promise<Response>
  resolveSession(headers: Headers): Promise<CloudActor | null>
  migrate: () => Promise<void>
}
