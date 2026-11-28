import type { RegisteredTool } from '@modelcontextprotocol/server'
import * as v from 'valibot'

import type { DocumentKind } from '@open-pencil/scene-graph'

import { DOCUMENT_KINDS } from '#mcp/tool/metadata'
import type { RPCSender } from '#mcp/tool/registration'

const documentListSchema = v.object({
  documents: v.array(v.looseObject({ kind: v.optional(v.picklist(DOCUMENT_KINDS)) }))
})

/**
 * Tools that are for some kinds of document only, such as the slide tools for decks. A session
 * lists one only while a document of its kind is open, so an agent working on a design carries no
 * schemas for decks. The open kinds are read when the session starts and whenever the session
 * lists, opens, or creates documents; turning a tool on or off tells the client its list changed.
 */
export function createDocumentKindTools(sendRPC: RPCSender) {
  const tools: { tool: RegisteredTool; kinds: readonly DocumentKind[] }[] = []

  function apply(open: ReadonlySet<DocumentKind>): void {
    for (const { tool, kinds } of tools) {
      const wanted = kinds.some((kind) => open.has(kind))
      if (wanted && !tool.enabled) tool.enable()
      else if (!wanted && tool.enabled) tool.disable()
    }
  }

  /** Follows a `list_documents` result: the kinds of the documents it lists are open. */
  function follow(result: unknown): void {
    const parsed = v.safeParse(documentListSchema, result)
    if (!parsed.success) return
    apply(new Set(parsed.output.documents.flatMap((document) => document.kind ?? [])))
  }

  return {
    follow,

    /** Takes a tool for `kinds`, off until a document of one of them is open. */
    add(tool: RegisteredTool, kinds: readonly DocumentKind[]): void {
      tool.disable()
      tools.push({ tool, kinds })
    },

    /** Asks the app which documents are open, as when the session starts or opens one. */
    async refresh(): Promise<void> {
      if (tools.length === 0) return
      // Without the app there are no documents to know, and the tools stay as they were.
      const response = await sendRPC({ command: 'list_documents', args: {} }).catch(() => null)
      const res = response as { ok?: boolean; result?: unknown } | null
      if (res && res.ok !== false) follow(res.result)
    }
  }
}
