import * as v from 'valibot'

import {
  cloudAccountMutationResponseSchema,
  cloudAccountStatusResponseSchema,
  cloudAuthenticationMethodsResponseSchema,
  cloudMFAEnableResponseSchema,
  cloudMFAEnableSchema,
  cloudMFARecoveryCodesResponseSchema,
  cloudMFAStatusResponseSchema,
  cloudMFAVerifyResponseSchema,
  cloudMFAVerifySchema,
  cloudPasskeyDeleteSchema,
  cloudPasskeysResponseSchema,
  cloudPasswordChangeSchema,
  cloudSocialLinkResponseSchema,
  cloudSocialLinkSchema,
  cloudUnlinkAuthenticationMethodSchema
} from '@open-pencil/cloud/contract'

import type { CloudRequest } from './request'

export function createAccountAPI(request: CloudRequest) {
  return {
    accountStatus(signal?: AbortSignal) {
      return request('/account/status', cloudAccountStatusResponseSchema, { signal })
    },
    authenticationMethods(signal?: AbortSignal) {
      return request('/account/authentication', cloudAuthenticationMethodsResponseSchema, {
        signal
      })
    },
    mfaStatus(signal?: AbortSignal) {
      return request('/account/mfa', cloudMFAStatusResponseSchema, { signal })
    },
    enableTOTP(password?: string, signal?: AbortSignal) {
      return request('/account/mfa/totp/enable', cloudMFAEnableResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudMFAEnableSchema, { password })),
        signal
      })
    },
    verifyTOTP(code: string, signal?: AbortSignal) {
      return request('/account/mfa/totp/verify', cloudMFAVerifyResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudMFAVerifySchema, { code })),
        signal
      })
    },
    verifyRecoveryCode(code: string, signal?: AbortSignal) {
      return request('/account/mfa/recovery/verify', cloudMFAVerifyResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudMFAVerifySchema, { code })),
        signal
      })
    },
    regenerateRecoveryCodes(password?: string, signal?: AbortSignal) {
      return request('/account/mfa/recovery/regenerate', cloudMFARecoveryCodesResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudMFAEnableSchema, { password })),
        signal
      })
    },
    disableTOTP(password?: string, signal?: AbortSignal) {
      return request('/account/mfa/totp/disable', cloudAccountMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudMFAEnableSchema, { password })),
        signal
      })
    },
    passkeys(signal?: AbortSignal) {
      return request('/account/mfa/passkeys', cloudPasskeysResponseSchema, { signal })
    },
    deletePasskey(id: string, signal?: AbortSignal) {
      return request('/account/mfa/passkeys/delete', cloudAccountMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudPasskeyDeleteSchema, { id })),
        signal
      })
    },
    changePassword(currentPassword: string, newPassword: string, signal?: AbortSignal) {
      return request(
        '/account/authentication/change-password',
        cloudAccountMutationResponseSchema,
        {
          method: 'POST',
          body: JSON.stringify(
            v.parse(cloudPasswordChangeSchema, { currentPassword, newPassword })
          ),
          signal
        }
      )
    },
    linkSocial(provider: 'google' | 'apple', callbackURL: string, signal?: AbortSignal) {
      return request('/account/authentication/link-social', cloudSocialLinkResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudSocialLinkSchema, { provider, callbackURL })),
        signal
      })
    },
    unlinkAuthenticationMethod(methodId: string, signal?: AbortSignal) {
      return request('/account/authentication/unlink', cloudAccountMutationResponseSchema, {
        method: 'POST',
        body: JSON.stringify(v.parse(cloudUnlinkAuthenticationMethodSchema, { methodId })),
        signal
      })
    },
    requestPasswordReset(email: string, redirectTo: string, signal?: AbortSignal) {
      return request('/auth/request-password-reset', v.object({ status: v.boolean() }), {
        method: 'POST',
        body: JSON.stringify({ email, redirectTo }),
        signal
      })
    }
  }
}
