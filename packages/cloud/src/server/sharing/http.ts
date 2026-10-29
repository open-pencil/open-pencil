import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents'
import {
  DocumentShareInvalidError,
  DocumentShareSignInRequiredError,
  InvitationDeliveryError
} from '#cloud/server/sharing/errors'
import { WorkspaceInvitationInvalidError } from '#cloud/server/workspaces/members'
import type { Context } from 'hono'

export function sharingDomainError(context: Context, error: unknown): Response | null {
  if (
    error instanceof DocumentNotFoundError ||
    error instanceof DocumentShareInvalidError ||
    error instanceof WorkspaceInvitationInvalidError
  ) {
    return context.json({ error: { code: 'not_found' as const } }, 404)
  }
  if (error instanceof DocumentShareSignInRequiredError) {
    return context.json({ error: { code: 'unauthorized' as const } }, 401)
  }
  if (error instanceof InvitationDeliveryError) {
    return context.json({ error: { code: 'invitation_delivery_failed' as const } }, 502)
  }
  if (error instanceof DocumentForbiddenError) {
    return context.json({ error: { code: 'forbidden' as const } }, 403)
  }
  return null
}

export async function sharingRoute<T>(
  context: Context,
  action: () => Promise<T>
): Promise<T | Response> {
  try {
    return await action()
  } catch (error) {
    const response = sharingDomainError(context, error)
    if (response) return response
    throw error
  }
}
