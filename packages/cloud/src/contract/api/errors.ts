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
  invalid_upload: 422,
  purge_failed: 503
} as const satisfies Record<string, number>

export type CloudAPIErrorCode = keyof typeof CLOUD_API_ERROR_STATUS

/** An error answer as it travels. */
export const cloudAPIErrorBodySchema = v.object({ error: v.object({ code: v.string() }) })
