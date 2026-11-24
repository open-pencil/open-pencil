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
  invalid_upload: 422,
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
