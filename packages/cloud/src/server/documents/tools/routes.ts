import {
  cloudDocumentToolCallSchema,
  type AgentToolOutcome,
  type CloudDocumentToolFailure
} from '#cloud/contract'
import { documentDomainError, type DocumentRouteEnvironment } from '#cloud/server/documents/routes'
import { tokenRoute } from '#cloud/server/tokens'
import { documentParams, validatedJSON } from '#cloud/server/validation'
import { Hono, type Context } from 'hono'

import {
  UnknownDocumentToolError,
  type DocumentToolEffect,
  type DocumentToolService
} from './service'

/**
 * How each failure answers: nobody who may run the call has the document open (a precondition
 * the person meets by opening it), the editor failed the call, or it did not answer in time.
 */
const FAILURE_STATUS = {
  editor_not_open: 409,
  tool_failed: 422,
  timeout: 504
} as const satisfies Record<CloudDocumentToolFailure, number>

function answer(context: Context, outcome: AgentToolOutcome) {
  if (outcome.ok) return context.json({ result: outcome.result })
  return context.json(
    {
      error: {
        code: outcome.failure,
        ...(outcome.message === undefined ? {} : { message: outcome.message })
      }
    },
    FAILURE_STATUS[outcome.failure]
  )
}

/**
 * Design tools on a document, run by the editor that has it open: one route for tools that read
 * it and one for those that change it, so each declares the scope it takes.
 */
export function createDocumentToolRoutes(service: DocumentToolService) {
  const run = async (
    context: Context<DocumentRouteEnvironment>,
    documentId: string,
    effect: DocumentToolEffect,
    call: { name: string; args: Record<string, unknown> }
  ) => {
    try {
      return answer(context, await service.run(context.get('actor'), documentId, effect, call))
    } catch (error) {
      if (error instanceof UnknownDocumentToolError) {
        return context.json({ error: { code: 'unknown_tool' as const } }, 404)
      }
      const response = documentDomainError(context, error)
      if (response) return response
      throw error
    }
  }
  return new Hono<DocumentRouteEnvironment>()
    .post(
      '/documents/:documentId/tools/read',
      documentParams,
      tokenRoute.read.document,
      validatedJSON(cloudDocumentToolCallSchema),
      (context) =>
        run(context, context.req.valid('param').documentId, 'read', context.req.valid('json'))
    )
    .post(
      '/documents/:documentId/tools/write',
      documentParams,
      tokenRoute.write.document,
      validatedJSON(cloudDocumentToolCallSchema),
      (context) =>
        run(context, context.req.valid('param').documentId, 'write', context.req.valid('json'))
    )
}
