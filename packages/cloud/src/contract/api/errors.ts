import type { ErrorMap } from '@orpc/contract'
import * as v from 'valibot'

/**
 * The codes the Cloud API answers errors with, and the status each comes with. Every error body
 * is `{ "error": { "code": … } }`, which editors of every version read.
 */
export const CLOUD_API_ERROR_STATUS = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  revision_conflict: 409,
  storage_quota_exceeded: 409,
  comment_limit_reached: 409,
  comment_conflict: 409,
  last_admin: 409,
  not_empty: 409,
  cleanup_pending: 409,
  already_member: 409,
  slug_conflict: 409,
  invalid_upload: 422,
  invalid_enrollment_transition: 409,
  account_approved: 409,
  document_not_restorable: 409,
  workspace_gone: 409,
  last_admin_required: 400,
  self_admin_action_forbidden: 400,
  last_authentication_method: 400,
  email_regeneration_unavailable: 400,
  // The account an administrator acts on lacks a second step; the console's own check, for the
  // administrator, answers 403 before any contract route.
  mfa_required: 400,
  two_step_unconfirmed: 400,
  rate_limited: 429,
  invitation_delivery_failed: 502,
  purge_failed: 503
} as const satisfies Record<string, number>

export type CloudAPIErrorCode = keyof typeof CLOUD_API_ERROR_STATUS

/** An error answer as it travels. */
export const cloudAPIErrorBodySchema = v.object({ error: v.object({ code: v.string() }) })

/** What a route about a document may answer besides its result. */
export const DOCUMENT_ERRORS = {
  not_found: {},
  forbidden: {},
  revision_conflict: {},
  storage_quota_exceeded: {},
  invalid_upload: {},
  purge_failed: {}
} satisfies ErrorMap

/** What a comment route may answer besides its result, on top of its document's or share's. */
export const COMMENT_ERRORS = { comment_limit_reached: {}, comment_conflict: {} } satisfies ErrorMap

/** What a route reached through a share link may answer besides its result. */
export const SHARE_ERRORS = {
  not_found: {},
  unauthorized: {},
  forbidden: {},
  rate_limited: {},
  invitation_delivery_failed: {}
} satisfies ErrorMap

/** What a workspace route may answer besides its result. */
export const WORKSPACE_ERRORS = {
  not_found: {},
  forbidden: {},
  last_admin: {},
  not_empty: {},
  cleanup_pending: {},
  already_member: {},
  slug_conflict: {},
  rate_limited: {}
} satisfies ErrorMap

/** What an administration route may answer besides its result. */
export const ADMIN_ERRORS = {
  invalid_request: {},
  not_found: {},
  invalid_enrollment_transition: {},
  account_approved: {},
  document_not_restorable: {},
  workspace_gone: {},
  last_admin_required: {},
  self_admin_action_forbidden: {},
  last_authentication_method: {},
  email_regeneration_unavailable: {}
} satisfies ErrorMap
