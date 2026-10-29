import { CloudPortalAPIError, type CloudAuthFailure } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { cloudAuthFailureMessage } from '@/app/cloud/sessions/account-form'

/** Words for a failed sign-in step, and for errors the provider sends back in the URL. */
export function usePortalFailureMessages() {
  const messages = useCloudPortalMessages()
  const failure = (kind: CloudAuthFailure) => cloudAuthFailureMessage(kind, messages.value)
  /** The provider's `error` query values after a social sign-in comes back, or null. */
  function callback(query: Record<string, unknown>): string | null {
    const values = ['error', 'error_description', 'error_code']
      .map((key) => query[key])
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    if (values.length === 0) return null
    if (values.includes('access_denied')) return messages.value.failureCancelled
    if (values.includes('enrollment_closed')) return messages.value.failureEnrollmentClosed
    if (values.includes('enrollment_approval_required')) return null
    return messages.value.failureUnavailable
  }
  /** Words for a failed account or console request. */
  function api(error: unknown): string {
    const value = messages.value
    if (!(error instanceof CloudPortalAPIError)) return value.failureUnavailable
    switch (error.kind) {
      case 'network':
      case 'timeout':
        return value.errorNetwork
      case 'authorization-required':
        return value.errorNotAllowed
      case 'authentication-required':
        return value.errorSessionNotFresh
      case 'cancelled':
      case 'protocol':
        return value.failureUnavailable
      case 'domain':
        break
    }
    const words: Partial<Record<NonNullable<CloudPortalAPIError['code']>, string>> = {
      current_password_invalid: value.failureInvalidCredentials,
      password_too_short: value.failurePasswordTooShort,
      password_too_long: value.failurePasswordTooLong,
      last_authentication_method: value.errorLastMethod,
      session_not_fresh: value.errorSessionNotFresh,
      last_admin_required: value.errorLastAdmin,
      self_admin_action_forbidden: value.errorSelfAction,
      mfa_required: value.errorTwoStepRequired,
      invalid_enrollment_transition: value.errorAlreadyDecided,
      rate_limited: value.failureRateLimited,
      email_unchanged: value.errorEmailUnchanged,
      email_change_unavailable: value.emailChangeUnavailable,
      current_session: value.errorCurrentSession,
      picture_invalid: value.errorPictureInvalid
    }
    return (error.code && words[error.code]) ?? value.failureUnavailable
  }
  return { failure, callback, api }
}
