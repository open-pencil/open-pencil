import type { Component } from 'vue'

import type { CloudSignInMethod, WorkspaceRole } from '@open-pencil/cloud/contract'

export type PortalSection = {
  id: string
  label: string
  icon: Component
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
  /** What the administrator who decided wrote down for the others. */
  note?: string | null
}

export type PortalPerson = {
  id: string
  name: string
  email: string
  image?: string | null
  admin: boolean
  suspended: boolean
  /** Why an administrator suspended the account, when they said. */
  suspendedReason?: string | null
  /** An authenticator app or a passkey confirms the account's sign-ins. */
  twoStep: boolean
  joinedOn: string
  /** When one of its sessions was last used, already worded; null when none is left. */
  lastActive: string | null
  workspaceCount: number
  you?: boolean
}

/** Something an administrator does to an account, each asked once more before it happens. */
export type PortalPersonAction =
  | 'make-admin'
  | 'remove-admin'
  | 'sign-out'
  | 'reset-two-step'
  | 'remove-picture'
  | 'suspend'
  | 'restore'

/** What the server read about the browser or app a session or sign-in came from. */
export type PortalDevice = {
  method: CloudSignInMethod | null
  browser: string | null
  system: string | null
  ipAddress: string | null
}

export type PortalSession = PortalDevice & {
  id: string
  current: boolean
  lastActive: string
  signedInOn: string
}

export type PortalSignIn = PortalDevice & {
  id: string
  when: string
}

export type PortalPersonDetail = {
  person: PortalPerson
  emailVerified: boolean
  methods: { provider: string; linkedOn: string }[]
  authenticator: boolean
  passkeyCount: number
  workspaces: { id: string; name: string; role: WorkspaceRole; memberCount: number }[]
  sessions: PortalSession[]
  signIns: PortalSignIn[]
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
  /** Why the administrator did it, when they said. */
  reason?: string | null
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
  accounts: number
  workspaces: number
  documents: number
  storedBytes: number
}
