import { CLOUD_API_ERROR_STATUS, type CloudAPIErrorCode } from '#cloud/contract'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents'
import { InvitationLimitError } from '#cloud/server/invitations'
import {
  DocumentShareInvalidError,
  DocumentShareSignInRequiredError,
  InvitationDeliveryError
} from '#cloud/server/sharing/errors'
import { WorkspaceInvitationInvalidError } from '#cloud/server/workspaces/members'
import { ORPCError } from '@orpc/client'
import type { Context } from 'hono'

/** The code a sharing domain error answers with, or null for any other error. */
export function sharingErrorCode(error: unknown): CloudAPIErrorCode | null {
  if (
    error instanceof DocumentNotFoundError ||
    error instanceof DocumentShareInvalidError ||
    error instanceof WorkspaceInvitationInvalidError
  ) {
    return 'not_found'
  }
  if (error instanceof DocumentShareSignInRequiredError) return 'unauthorized'
  if (error instanceof InvitationDeliveryError) return 'invitation_delivery_failed'
  if (error instanceof InvitationLimitError) return 'rate_limited'
  if (error instanceof DocumentForbiddenError) return 'forbidden'
  return null
}

/** Answers a sharing domain error with its code, and lets every other error through. */
export async function sharingErrors<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next()
  } catch (error) {
    const code = sharingErrorCode(error)
    if (code) throw new ORPCError(code, { cause: error })
    throw error
  }
}

export function sharingDomainError(context: Context, error: unknown): Response | null {
  const code = sharingErrorCode(error)
  return code ? context.json({ error: { code } }, CLOUD_API_ERROR_STATUS[code]) : null
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
