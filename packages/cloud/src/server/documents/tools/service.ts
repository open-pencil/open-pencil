import {
  MAX_AGENT_TOOL_NAME_LENGTH,
  presenceName,
  type AgentToolCall,
  type AgentToolCaller,
  type AgentToolOutcome
} from '#cloud/contract'
import type { CloudActor } from '#cloud/server/auth'
import type { CloudDatabase } from '#cloud/server/db'
import { canEditDocument } from '#cloud/server/documents/access'
import { DocumentForbiddenError, DocumentNotFoundError } from '#cloud/server/documents/errors'
import type { DocumentService } from '#cloud/server/documents/service'
import { designTool, takesPath } from '#cloud/server/mcp/catalog'
import { omit } from 'es-toolkit/object'
import type { Kysely } from 'kysely'

/**
 * Runs a design tool on a document through an editor of the calling person that has it open, on
 * the relay the runtime runs (`createCollaborationRelay`'s `callTool`).
 */
export type CallDocumentTool = (
  documentId: string,
  userId: string,
  call: AgentToolCall
) => Promise<AgentToolOutcome>

/** What a tool call may do: read the document, or change it as well. */
export type DocumentToolEffect = 'read' | 'write'

/** The name an app goes by on the approval page, which the editor shows on the agent. */
async function appName(database: Kysely<CloudDatabase>, clientId: string): Promise<string | null> {
  const client = await database
    .selectFrom('oauthClient')
    .select('name')
    .where('clientId', '=', clientId)
    .executeTakeFirst()
  return client?.name ?? null
}

/**
 * Design tools apps and scripts run on documents. The server holds no editor: a call goes to an
 * editor tab of the same person that has the document open, which runs it as their own edit, so
 * it reaches only what they may change. A tool that changes the document needs edit access and
 * `documents:write`; one that only reads needs neither.
 */
export function createDocumentToolService(options: {
  database: Kysely<CloudDatabase>
  documents: DocumentService
  callTool?: CallDocumentTool
}) {
  // An app's client ID can be a long URL and its name anything it registered, so both are cut to
  // what the editor takes; a call it cannot read would never be answered.
  const bounded = (text: string) => text.slice(0, MAX_AGENT_TOOL_NAME_LENGTH)
  async function caller(actor: CloudActor): Promise<AgentToolCaller> {
    if (actor.grant) {
      const name = await appName(options.database, actor.grant.clientId)
      return {
        session: bounded(`app:${actor.grant.clientId}`),
        ...(name ? { client: presenceName(name) } : {})
      }
    }
    return { session: bounded(`${actor.credential ?? 'session'}:${actor.userId}`) }
  }

  return {
    async run(
      actor: CloudActor,
      documentId: string,
      effect: DocumentToolEffect,
      call: Pick<AgentToolCall, 'name' | 'args'>
    ): Promise<AgentToolOutcome> {
      const tool = designTool(call.name)
      if (!tool || tool.mutates !== (effect === 'write')) {
        throw new DocumentNotFoundError()
      }
      const access = await options.documents.access(actor.userId, documentId)
      if (effect === 'write' && !canEditDocument(access)) throw new DocumentForbiddenError()
      if (!options.callTool) return { ok: false, failure: 'editor_not_open' }
      // Local MCP writes a `path` to disk itself; here it would only change what the tool answers.
      const args = takesPath(tool) ? call.args : omit(call.args, ['path'])
      return options.callTool(documentId, actor.userId, {
        name: call.name,
        args,
        agent: await caller(actor)
      })
    }
  }
}

export type DocumentToolService = ReturnType<typeof createDocumentToolService>
