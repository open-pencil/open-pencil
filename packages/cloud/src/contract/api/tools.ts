import { oc } from '@orpc/contract'
import * as v from 'valibot'

import { agentToolOutcomeSchema, cloudDocumentToolCallSchema } from '../agent-tools'
import { DOCUMENT_ERRORS } from './errors'
import { documentParamsSchema } from './params'
import { at } from './route'

const route = oc
  .errors(DOCUMENT_ERRORS)
  .input(v.object({ params: documentParamsSchema, body: cloudDocumentToolCallSchema }))
  .output(agentToolOutcomeSchema)

/**
 * Design tools on a document, run by an editor that has it open: one route for tools that read it
 * and one for those that change it, so each takes the scope it needs. A call that reached no
 * editor, or that its editor failed, is an outcome rather than an error of the route.
 */
export const documentToolsContract = {
  read: route.meta(at('POST', '/documents/{documentId}/tools/read')),
  write: route.meta(at('POST', '/documents/{documentId}/tools/write'))
}
