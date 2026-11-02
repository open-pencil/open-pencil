import type { CloudAuthFailure } from '@open-pencil/cloud/client'

export type CloudServerKind = 'official' | 'self-hosted'

export type CloudSignInMethod = 'google' | 'apple' | 'email'

export type CloudConnectStep = 'server' | 'checking' | 'sign-in' | 'sign-up' | 'verify' | 'device'

export type CloudConnectError =
  | 'unreachable'
  | 'not-cloud'
  | 'outdated'
  | 'invalid-address'
  | 'denied'
  | 'expired'
  | 'sign-in-failed'

export type CloudConnectServer = {
  host: string
  /** Ways that leave the app: providers, and email where the form cannot be used here. */
  methods: CloudSignInMethod[]
  /** Email and password in the dialog, when this app can sign in with them directly. */
  emailPassword: { signUp: boolean; minimumPasswordLength: number } | null
  approvalRequired: boolean
}

export type { CloudAuthFailure }
