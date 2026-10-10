export type PortalSection = {
  id: string
  label: string
  group: string
  count?: number
}

export type PortalSignInMethod = 'google' | 'apple'

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked'

export type AccessRequest = {
  id: string
  name: string | null
  email: string
  reason: string | null
  requestedOn: string
  status: AccessRequestStatus
  reviewedBy?: string | null
}

export type PortalPerson = {
  id: string
  name: string
  email: string
  admin: boolean
  suspended: boolean
  joinedOn: string
  you?: boolean
}

export type PortalEmail = {
  id: string
  kind: string
  recipient: string
  status: 'sent' | 'waiting' | 'failed' | 'suppressed'
  attempts: number
  when: string
  error?: string | null
}

export type PortalActivityEntry = {
  id: string
  actor: { id: string; name: string }
  /** The server's action code, such as `enrollment.approved`. */
  action: string
  target: string
  when: string
}

export type PortalLinkedMethod = {
  id: string
  provider: 'credential' | PortalSignInMethod
  linkedOn: string
  canUnlink: boolean
}

export type PortalServerStatus = {
  deployment: 'official' | 'self-hosted'
  enrollmentMode: 'open' | 'approval' | 'closed'
  emailTransport: 'none' | 'smtp' | 'cloudflare'
  pendingEnrollment: number
  pendingEmail: number
  failedEmail: number
}
