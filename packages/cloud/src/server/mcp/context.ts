import { cloudDocumentURL, type CloudTokenScope } from '#cloud/contract'

import type { MCPAPIRequest } from './api'
import { apiError, errorResult } from './results'

/** Who an MCP request comes from, as the document API knows the token, and how to reach it. */
export type MCPCaller = {
  api: MCPAPIRequest
  publicURL: string
  scopes: readonly CloudTokenScope[]
  /** The workspace an app's grant reaches, which its tools work in unless told otherwise. */
  workspaceId?: string
}

/** Where a person opens a document, which a tool gives the model to pass on. */
export function documentLink(caller: MCPCaller, documentId: string): string {
  return cloudDocumentURL(caller.publicURL, documentId)
}

/** A document API failure in words the model can act on. */
export function apiFailure(status: number, body: unknown) {
  const error = apiError(body)
  if (status === 401) {
    return errorResult('The connection to OpenPencil Cloud ended. Connect the app again.')
  }
  if (error?.code === 'insufficient_scope') {
    return errorResult(
      'This connection may only read documents. To change them, connect the app again and choose Read and write.'
    )
  }
  if (status === 403) return errorResult('You may only view this document, not change it.')
  if (status === 404) {
    return errorResult(
      'Not found: it does not exist, is in Trash, or is outside the workspace this connection reaches.'
    )
  }
  return errorResult(
    `OpenPencil Cloud answered ${status}${error ? ` (${error.code}${error.message ? `: ${error.message}` : ''})` : ''}.`
  )
}
