import type { CloudActor } from '#cloud/server/auth/session'

export type CloudAdminUser = {
  id: string
  name: string
  email: string
  role?: string
  banned: boolean | null
  banReason?: string | null
  createdAt: Date
}

export interface CloudAuthAdapter {
  handler(request: Request): Promise<Response>
  resolveSession(headers: Headers): Promise<CloudActor | null>
  listUsers(
    headers: Headers,
    query?: { searchValue?: string; limit?: number; offset?: number }
  ): Promise<{ users: CloudAdminUser[]; total: number }>
  banUser(headers: Headers, userId: string, reason?: string): Promise<void>
  unbanUser(headers: Headers, userId: string): Promise<void>
  revokeUserSessions(headers: Headers, userId: string): Promise<void>
  setRole(headers: Headers, userId: string, role: 'user' | 'admin'): Promise<void>
  migrate: () => Promise<void>
  schemaVersion: string
}
