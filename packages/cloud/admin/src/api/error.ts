import { CloudAdminAPIError } from '#admin/api/client'
import type { useCloudI18n } from '#admin/i18n/use'

type ErrorMessages = ReturnType<typeof useCloudI18n>['errors']['value']

export function errorMessage(error: unknown, messages: ErrorMessages): string {
  if (!(error instanceof CloudAdminAPIError)) return messages.unknown
  if (error.kind === 'network') return messages.network
  if (error.kind === 'timeout') return messages.timeout
  if (error.kind === 'protocol') return messages.protocol
  if (error.kind === 'authentication-required') return messages.authenticationRequired
  if (error.kind === 'authorization-required') return messages.authorizationRequired
  if (error.kind === 'cancelled') return ''
  if (error.code === 'invalid_enrollment_transition') return messages.invalidEnrollmentTransition
  if (error.code === 'last_admin_required') return messages.lastAdminRequired
  if (error.code === 'self_admin_action_forbidden') return messages.selfActionForbidden
  if (error.code === 'email_regeneration_unavailable') return messages.emailRegenerationUnavailable
  return messages.unknown
}
