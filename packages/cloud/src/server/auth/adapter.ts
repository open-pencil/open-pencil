import type { CloudAccountSession, CloudSignIn } from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth/session'

export type CloudMFAStatus = {
  required: boolean
  enabled: boolean
  /** Whether an authenticator app is set up, apart from any passkeys. */
  totpEnabled: boolean
  assured: boolean
  totpAvailable: boolean
  passkeysAvailable: boolean
  recoveryCodesAvailable: boolean
}

export type CloudIdentity = {
  userId: string
  email: string
  name: string
  image?: string | null
  deploymentRole?: 'user' | 'admin'
}

export type CloudAccountProfile = {
  id: string
  name: string
  email: string
  image: string | null
  createdAt: Date
}

export type CloudAuthenticationMethodRecord = {
  id: string
  providerId: string
  createdAt: Date
}

export interface CloudAuthAdapter {
  handler(request: Request): Promise<Response>
  resolveIdentity(headers: Headers): Promise<CloudIdentity | null>
  resolveSession(headers: Headers): Promise<CloudActor | null>
  listAuthenticationMethods(headers: Headers): Promise<CloudAuthenticationMethodRecord[]>
  changePassword(
    headers: Headers,
    input: { currentPassword: string; newPassword: string }
  ): Promise<void>
  startSocialLink(
    headers: Headers,
    input: { provider: 'google' | 'apple'; callbackURL: string }
  ): Promise<string>
  unlinkAuthenticationMethod(headers: Headers, methodId: string): Promise<void>
  banUser(headers: Headers, userId: string, reason?: string): Promise<void>
  unbanUser(headers: Headers, userId: string): Promise<void>
  revokeUserSessions(headers: Headers, userId: string): Promise<void>
  setRole(headers: Headers, userId: string, role: 'user' | 'admin'): Promise<void>
  mfaStatus(headers: Headers): Promise<CloudMFAStatus | null>
  enableTOTP(
    headers: Headers,
    password?: string
  ): Promise<{ totpURI: string; backupCodes: string[] }>
  verifyTOTP(headers: Headers, code: string): Promise<Response | undefined>
  verifyRecoveryCode(headers: Headers, code: string): Promise<Response | undefined>
  generateRecoveryCodes(headers: Headers, password?: string): Promise<string[]>
  disableTOTP(headers: Headers, password?: string): Promise<void>
  listPasskeys(headers: Headers): Promise<Array<{ id: string; name?: string; createdAt: Date }>>
  deletePasskey(headers: Headers, id: string): Promise<void>
  /** Whether the server can confirm a new email address, which changing one needs. */
  emailChangeAvailable: boolean
  profile(headers: Headers): Promise<CloudAccountProfile | null>
  updateProfile(headers: Headers, input: { name: string }): Promise<void>
  /** Sends the confirmation to the new address and tells the old one which address it is. */
  changeEmail(headers: Headers, input: { newEmail: string; callbackURL: string }): Promise<void>
  sessions(headers: Headers): Promise<CloudAccountSession[] | null>
  /** Ends one of the person's other sessions; their current one ends by signing out. */
  revokeSession(headers: Headers, sessionId: string): Promise<void>
  revokeOtherSessions(headers: Headers): Promise<void>
  signIns(headers: Headers): Promise<CloudSignIn[] | null>
  migrate: () => Promise<void>
  schemaVersion: string
}
