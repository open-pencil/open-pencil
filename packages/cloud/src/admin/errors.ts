export type AdminErrorCode =
  | 'invalid_enrollment_transition'
  | 'last_admin_required'
  | 'self_admin_action_forbidden'
  | 'last_authentication_method'
  | 'account_approved'
  | 'email_regeneration_unavailable'
  | 'mfa_required'
  | 'two_step_unconfirmed'
  | 'document_not_restorable'
  | 'workspace_gone'

export class AdminDomainError extends Error {
  override readonly name = 'AdminDomainError'
  constructor(
    readonly code: AdminErrorCode,
    message: string
  ) {
    super(message)
  }
}
