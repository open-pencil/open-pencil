import { cloudDocumentURL, type CloudTokenScope } from '#cloud/contract'
import type { CallToolResult } from '@modelcontextprotocol/server'

import { MCPAPIError, type MCPAPI } from './api'
import { errorResult } from './results'

/** Who an MCP request comes from, as the document API knows the token, and how to reach it. */
export type MCPCaller = {
  api: MCPAPI
  publicURL: string
  scopes: readonly CloudTokenScope[]
  /** The workspace an app's grant reaches, which its tools work in unless told otherwise. */
  workspaceId?: string
}

/** Where a person opens a document, which a tool gives the model to pass on. */
export function documentLink(caller: MCPCaller, documentId: string): string {
  return cloudDocumentURL(caller.publicURL, documentId)
}

/** An API refusal in words the model can act on. */
function refusal(error: MCPAPIError): string {
  if (error.status === 401) {
    return 'The connection to OpenPencil Cloud ended. Connect the app again.'
  }
  if (error.code === 'insufficient_scope') {
    return 'This connection may only read documents. To change them, connect the app again and choose Read and write.'
  }
  if (error.status === 403) return 'You may not do this with this document.'
  if (error.status === 404) {
    return 'Not found: it does not exist, is in Trash, or is outside the workspace this connection reaches.'
  }
  return `OpenPencil Cloud answered ${error.status}${error.code ? ` (${error.code})` : ''}.`
}

/** Runs a tool's API calls, answering a refusal with what the model can do about it. */
export async function answering(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof MCPAPIError) return errorResult(refusal(error))
    throw error
  }
}
