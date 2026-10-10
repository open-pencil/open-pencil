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
  name: string
  email: string
  reason: string
  requestedAgo: string
  status: AccessRequestStatus
  reviewedBy?: string
}

export type PortalPerson = {
  id: string
  name: string
  email: string
  admin: boolean
  suspended: boolean
  twoStep: boolean
  joinedAgo: string
  you?: boolean
}

export type PortalEmail = {
  id: string
  subject: string
  recipient: string
  status: 'sent' | 'waiting' | 'failed'
  attempts: number
  when: string
  error?: string
}

export type PortalActivityEntry = {
  id: string
  actor: { id: string; name: string }
  action: string
  target: string
  when: string
}
