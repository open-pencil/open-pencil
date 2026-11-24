import { documentKindSchema, documentSummarySchema, type CloudTokenScope } from '#cloud/contract'
import { scopesAllow } from '#cloud/server/tokens'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import * as v from 'valibot'

import { apiFailure, documentLink, type MCPCaller } from './context'
import { errorResult, jsonResult } from './results'
import { toolInput } from './schema'

const id = (description: string) => v.pipe(v.string(), v.uuid(), v.description(description))
const documentIdSchema = id('The document, as list_documents names it.')
const workspaceIdSchema = v.optional(
  id(
    'The workspace, as list_workspaces names it. An app connected to one workspace works there when this is left out.'
  )
)

const documentsResponseSchema = v.object({ documents: v.array(documentSummarySchema) })
const documentResponseSchema = v.object({ document: documentSummarySchema })

type DocumentTool = {
  name: string
  description: string
  scope: CloudTokenScope
  input: v.ObjectSchema<v.ObjectEntries, undefined>
  run: (caller: MCPCaller, args: Record<string, unknown>) => Promise<CallToolResult>
}

/** A record ID a tool's input checked, as its path takes it. */
const idOf = (value: unknown): string => v.parse(v.string(), value)

/** The workspace a call names, or the one an app's grant reaches. */
function workspaceOf(caller: MCPCaller, named: unknown): string | null {
  return typeof named === 'string' ? named : (caller.workspaceId ?? null)
}

const NO_WORKSPACE = errorResult('Name the workspace: list_workspaces lists them.')

/** What a document is, with where its person opens it. */
function withLink(caller: MCPCaller, document: v.InferOutput<typeof documentSummarySchema>) {
  return { ...document, url: documentLink(caller, document.id) }
}

const DOCUMENT_TOOLS: DocumentTool[] = [
  {
    name: 'list_workspaces',
    description: 'List the OpenPencil Cloud workspaces this connection reaches.',
    scope: 'documents:read',
    input: v.object({}),
    async run(caller) {
      const { status, body } = await caller.api('GET', '/api/workspaces')
      return status === 200 ? jsonResult(body) : apiFailure(status, body)
    }
  },
  {
    name: 'list_documents',
    description:
      'List the documents in a workspace, with the link where each opens in OpenPencil. Pass query to keep those whose name contains it.',
    scope: 'documents:read',
    input: v.object({
      workspace_id: workspaceIdSchema,
      query: v.optional(v.pipe(v.string(), v.description('Text the document name contains.')))
    }),
    async run(caller, args) {
      const workspace = workspaceOf(caller, args.workspace_id)
      if (!workspace) return NO_WORKSPACE
      const { status, body } = await caller.api('GET', `/api/workspaces/${workspace}/documents`)
      const listed = v.safeParse(documentsResponseSchema, body)
      if (status !== 200 || !listed.success) return apiFailure(status, body)
      const query = typeof args.query === 'string' ? args.query.toLocaleLowerCase() : ''
      return jsonResult({
        documents: listed.output.documents
          .filter((document) => document.name.toLocaleLowerCase().includes(query))
          .map((document) => withLink(caller, document))
      })
    }
  },
  {
    name: 'create_document',
    description:
      'Create an empty document in a workspace. To design in it, the person opens its link in OpenPencil, and the design tools then work on it.',
    scope: 'documents:write',
    input: v.object({
      workspace_id: workspaceIdSchema,
      name: v.pipe(v.string(), v.minLength(1), v.description('The document name.')),
      kind: v.optional(
        v.pipe(documentKindSchema, v.description('A design (the default) or a board.'))
      )
    }),
    async run(caller, args) {
      const workspace = workspaceOf(caller, args.workspace_id)
      if (!workspace) return NO_WORKSPACE
      const { status, body } = await caller.api('POST', `/api/workspaces/${workspace}/documents`, {
        name: args.name,
        ...(args.kind ? { kind: args.kind } : {})
      })
      const created = v.safeParse(documentResponseSchema, body)
      if (status !== 201 || !created.success) return apiFailure(status, body)
      return jsonResult({ document: withLink(caller, created.output.document) })
    }
  },
  {
    name: 'delete_document',
    description: 'Move a document to Trash, where restore_document brings it back.',
    scope: 'documents:write',
    input: v.object({ document_id: documentIdSchema }),
    async run(caller, args) {
      const { status, body } = await caller.api(
        'DELETE',
        `/api/documents/${idOf(args.document_id)}`
      )
      return status === 204
        ? jsonResult({ trashed: idOf(args.document_id) })
        : apiFailure(status, body)
    }
  },
  {
    name: 'restore_document',
    description: 'Bring a document back from Trash.',
    scope: 'documents:write',
    input: v.object({ document_id: documentIdSchema }),
    async run(caller, args) {
      const { status, body } = await caller.api(
        'POST',
        `/api/trash/${idOf(args.document_id)}/restore`
      )
      return status === 204
        ? jsonResult({ restored: idOf(args.document_id) })
        : apiFailure(status, body)
    }
  },
  {
    name: 'list_versions',
    description: "List a document's version history: named versions and checkpoints.",
    scope: 'documents:read',
    input: v.object({ document_id: documentIdSchema }),
    async run(caller, args) {
      const { status, body } = await caller.api(
        'GET',
        `/api/documents/${idOf(args.document_id)}/versions`
      )
      return status === 200 ? jsonResult(body) : apiFailure(status, body)
    }
  },
  {
    name: 'save_version',
    description:
      'Save the document as it is now to its version history under a name, as Save to version history does, so it can be restored later.',
    scope: 'documents:write',
    // The document API trims and checks the name and description as Save to version history does.
    input: v.object({
      document_id: documentIdSchema,
      name: v.pipe(v.string(), v.minLength(1), v.description('The version name.')),
      description: v.optional(v.pipe(v.string(), v.description('What changed in this version.')))
    }),
    async run(caller, args) {
      const { document_id: document, ...version } = args
      const { status, body } = await caller.api(
        'POST',
        `/api/documents/${idOf(document)}/versions`,
        version
      )
      return status === 201 || status === 200 ? jsonResult(body) : apiFailure(status, body)
    }
  }
]

/** Registers the tools that manage documents and their history, as far as the token's scopes go. */
export function registerDocumentTools(server: McpServer, caller: MCPCaller) {
  for (const tool of DOCUMENT_TOOLS) {
    if (!scopesAllow(caller.scopes, tool.scope)) continue
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: toolInput(tool.input),
        annotations: {
          readOnlyHint: tool.scope === 'documents:read',
          openWorldHint: false
        }
      },
      (args) => tool.run(caller, args)
    )
  }
}
