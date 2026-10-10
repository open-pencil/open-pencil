export type AdminErrorCode =
  | 'invalid_enrollment_transition'
  | 'last_admin_required'
  | 'self_admin_action_forbidden'
  | 'email_regeneration_unavailable'
  | 'mfa_required'

export class AdminDomainError extends Error {
  override readonly name = 'AdminDomainError'
  constructor(
    readonly code: AdminErrorCode,
    message: string
  ) {
    super(message)
  }
}

export function adminErrorStatus(error: AdminDomainError): 400 | 409 {
  return error.code === 'invalid_enrollment_transition' ? 409 : 400
}
