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

export type CloudIdentity = {
  userId: string
  email: string
  name: string
  deploymentRole?: 'user' | 'admin'
}

export interface CloudAuthAdapter {
  handler(request: Request): Promise<Response>
  resolveIdentity(headers: Headers): Promise<CloudIdentity | null>
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
