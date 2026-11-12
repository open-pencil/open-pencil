import {
  accountEntitlementsResponseSchema,
  billingTokenSchema,
  cloudAccessTokenCreatedResponseSchema,
  cloudAccessTokensResponseSchema,
  cloudAccountDeletionResponseSchema,
  cloudAccountMutationResponseSchema,
  cloudAccountSessionsResponseSchema,
  cloudAccountStatusResponseSchema,
  cloudAuthenticationMethodsResponseSchema,
  cloudMFAEnableResponseSchema,
  cloudMFARecoveryCodesResponseSchema,
  cloudMFAStatusResponseSchema,
  cloudMFAVerifyResponseSchema,
  cloudPasskeysResponseSchema,
  cloudPictureResponseSchema,
  cloudProfileResponseSchema,
  cloudSignInsResponseSchema,
  cloudSocialLinkResponseSchema,
  type CloudAccessTokenCreate,
  type CloudLocale
} from '#cloud/contract'

import type { CloudCall, PortalRouteClients } from './request'

export function createAccountAPI(call: CloudCall, { account, tokens, api }: PortalRouteClients) {
  return {
    /** The account's plan, and the storage its workspaces hold together. */
    entitlements(signal?: AbortSignal) {
      return call(
        (options) => api.account.entitlements.$get(undefined, options),
        accountEntitlementsResponseSchema,
        signal
      )
    },
    /** A short-lived token for the deployment's billing, for this account. */
    billingToken(signal?: AbortSignal) {
      return call(
        (options) => api.billing.token.$post(undefined, options),
        billingTokenSchema,
        signal
      )
    },
    accountStatus(signal?: AbortSignal) {
      return call(
        (options) => account.status.$get(undefined, options),
        cloudAccountStatusResponseSchema,
        signal
      )
    },
    /** Accepts the server's terms at `version`, the one its discovery names. */
    acceptTerms(version: string, signal?: AbortSignal) {
      return call(
        (options) => account.terms.$post({ json: { version } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    authenticationMethods(signal?: AbortSignal) {
      return call(
        (options) => account.authentication.$get(undefined, options),
        cloudAuthenticationMethodsResponseSchema,
        signal
      )
    },
    mfaStatus(signal?: AbortSignal) {
      return call(
        (options) => account.mfa.$get(undefined, options),
        cloudMFAStatusResponseSchema,
        signal
      )
    },
    enableTOTP(password?: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.totp.enable.$post({ json: { password } }, options),
        cloudMFAEnableResponseSchema,
        signal
      )
    },
    verifyTOTP(code: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.totp.verify.$post({ json: { code } }, options),
        cloudMFAVerifyResponseSchema,
        signal
      )
    },
    verifyRecoveryCode(code: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.recovery.verify.$post({ json: { code } }, options),
        cloudMFAVerifyResponseSchema,
        signal
      )
    },
    regenerateRecoveryCodes(password?: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.recovery.regenerate.$post({ json: { password } }, options),
        cloudMFARecoveryCodesResponseSchema,
        signal
      )
    },
    disableTOTP(password?: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.totp.disable.$post({ json: { password } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    passkeys(signal?: AbortSignal) {
      return call(
        (options) => account.mfa.passkeys.$get(undefined, options),
        cloudPasskeysResponseSchema,
        signal
      )
    },
    deletePasskey(id: string, signal?: AbortSignal) {
      return call(
        (options) => account.mfa.passkeys.delete.$post({ json: { id } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    changePassword(currentPassword: string, newPassword: string, signal?: AbortSignal) {
      return call(
        (options) =>
          account.authentication['change-password'].$post(
            { json: { currentPassword, newPassword } },
            options
          ),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    linkSocial(provider: 'google' | 'apple', callbackURL: string, signal?: AbortSignal) {
      return call(
        (options) =>
          account.authentication['link-social'].$post({ json: { provider, callbackURL } }, options),
        cloudSocialLinkResponseSchema,
        signal
      )
    },
    profile(signal?: AbortSignal) {
      return call(
        (options) => account.profile.$get(undefined, options),
        cloudProfileResponseSchema,
        signal
      )
    },
    /** The language the server writes to the account in: the app's. */
    setLocale(locale: CloudLocale, signal?: AbortSignal) {
      return call(
        (options) => account.locale.$put({ json: { locale } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    updateProfile(name: string, signal?: AbortSignal) {
      return call(
        (options) => account.profile.$post({ json: { name } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    /** Shows `data`, a Base64 PNG or JPEG the page cropped and shrank, as the account's picture. */
    uploadPicture(data: string, signal?: AbortSignal) {
      return call(
        (options) => account.profile.picture.$put({ json: { data } }, options),
        cloudPictureResponseSchema,
        signal
      )
    },
    removePicture(signal?: AbortSignal) {
      return call(
        (options) => account.profile.picture.$delete(undefined, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    /** Sends a confirmation to the new address; the email changes once it is followed. */
    changeEmail(newEmail: string, callbackURL: string, signal?: AbortSignal) {
      return call(
        (options) => account.profile.email.$post({ json: { newEmail, callbackURL } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    /** The account's personal access tokens, by their first characters; never a whole one. */
    accessTokens(signal?: AbortSignal) {
      return call(
        (options) => tokens.$get(undefined, options),
        cloudAccessTokensResponseSchema,
        signal
      )
    },
    /** Makes a token; the answer holds the whole token, which is shown this once. */
    createAccessToken(input: CloudAccessTokenCreate, signal?: AbortSignal) {
      return call(
        (options) => tokens.create.$post({ json: input }, options),
        cloudAccessTokenCreatedResponseSchema,
        signal
      )
    },
    revokeAccessToken(id: string, signal?: AbortSignal) {
      return call(
        (options) => tokens.revoke.$post({ json: { id } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    sessions(signal?: AbortSignal) {
      return call(
        (options) => account.sessions.$get(undefined, options),
        cloudAccountSessionsResponseSchema,
        signal
      )
    },
    revokeSession(sessionId: string, signal?: AbortSignal) {
      return call(
        (options) => account.sessions.revoke.$post({ json: { sessionId } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    revokeOtherSessions(signal?: AbortSignal) {
      return call(
        (options) => account.sessions['revoke-others'].$post(undefined, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    signIns(signal?: AbortSignal) {
      return call(
        (options) => account['sign-ins'].$get(undefined, options),
        cloudSignInsResponseSchema,
        signal
      )
    },
    /** What deleting the account takes, and the workspaces that stop it. */
    accountDeletion(signal?: AbortSignal) {
      return call(
        (options) => account.deletion.$get(undefined, options),
        cloudAccountDeletionResponseSchema,
        signal
      )
    },
    /** Deletes the account; a session that signed in a while ago gives its password. */
    deleteAccount(password?: string, signal?: AbortSignal) {
      return call(
        (options) => account.delete.$post({ json: { password } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    },
    unlinkAuthenticationMethod(methodId: string, signal?: AbortSignal) {
      return call(
        (options) => account.authentication.unlink.$post({ json: { methodId } }, options),
        cloudAccountMutationResponseSchema,
        signal
      )
    }
  }
}
