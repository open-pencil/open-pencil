export type AdminErrorCode =
  | 'invalid_enrollment_transition'
  | 'last_admin_required'
  | 'self_admin_action_forbidden'
  | 'email_regeneration_unavailable'
  | 'mfa_required'
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

const CONFLICTS = new Set<AdminErrorCode>([
  'invalid_enrollment_transition',
  'document_not_restorable',
  'workspace_gone'
])

export function adminErrorStatus(error: AdminDomainError): 400 | 409 {
  return CONFLICTS.has(error.code) ? 409 : 400
}
