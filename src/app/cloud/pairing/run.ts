import { isRecord } from '@open-pencil/std/records'

import { isToolError } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import {
  listAutomationDocuments,
  rememberSessionDocument,
  resolveAutomationTarget,
  targetToResult,
  withSessionDocument
} from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { withOwnPage, type RunAgentTool } from '@/app/cloud/rooms/agent-tools'
import { createDocumentTab, switchTab } from '@/app/tabs'

let handleTool: ReturnType<typeof createAutomationToolHandler> | null = null

/**
 * Runs a paired agent's call as the local MCP server's are run: on the document it names, or the one
 * it last worked on, or the active one. Files and settings stay out of its reach.
 */
export const runPairedTool: RunAgentTool = async (store, { name, args, agent }, signal) => {
  if (name === 'list_documents') return { documents: listAutomationDocuments(store) }
  if (name === 'create_document') {
    const tab = createDocumentTab('design')
    const created = targetToResult(resolveAutomationTarget(tab.store, { document_id: tab.id }))
    rememberSessionDocument(agent.session, created)
    return { created: true, target: created }
  }
  const { document_id, page_id, ...rest } = args
  const named = withSessionDocument(agent.session, { document_id, page_id })
  const target = resolveAutomationTarget(store, named)
  rememberSessionDocument(agent.session, target)
  if (!(await target.store.preparePageNodes(target.pageId))) {
    throw new Error(`Page "${target.pageId}" was closed before it finished loading`)
  }
  signal.throwIfAborted()
  if (name === 'activate_document') {
    switchTab(target.documentId)
    if (target.store.state.currentPageId !== target.pageId) {
      await target.store.switchPage(target.pageId)
    }
    return { activated: true, target: targetToResult(target) }
  }
  handleTool ??= createAutomationToolHandler(makeFigmaFromStore)
  const answer = await handleTool(
    target,
    {
      name,
      args: withOwnPage(name, rest, page_id),
      agent: { session: agent.session, kind: 'mcp', client: agent.client }
    },
    signal
  )
  const result = isRecord(answer) ? answer.result : answer
  if (isToolError(result)) throw new Error(String(result.error))
  return result
}
