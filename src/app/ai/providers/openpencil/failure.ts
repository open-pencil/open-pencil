import { APICallError } from 'ai'
import * as v from 'valibot'

import { aiErrorSchema } from '@open-pencil/cloud/contract'

const errorBodySchema = v.pipe(v.string(), v.parseJson(), aiErrorSchema)

/**
 * Cloud's AI service refusing a request because the workspace has no credits left, with when its
 * allowance renews if the service says. `null` for anything else, such as an upstream's own 402
 * the service passed through, which is the service's provider account, not the workspace.
 */
export function cloudCreditRefusal(error: unknown): { resetsAt: string | null } | null {
  if (!APICallError.isInstance(error) || error.responseBody === undefined) return null
  const parsed = v.safeParse(errorBodySchema, error.responseBody)
  if (!parsed.success || parsed.output.error.code !== 'insufficient_credits') return null
  return { resetsAt: parsed.output.error.resetsAt ?? null }
}
