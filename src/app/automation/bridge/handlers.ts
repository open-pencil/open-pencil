import { omit } from 'es-toolkit'

import type { FigmaAPI } from '@open-pencil/core/figma-api'

import { agentChatStore } from '@/app/ai/reply/run'
import { agentSessionOpened, endAgentSession, readAgentSession } from '@/app/automation/agents'
import {
  handleActivateDocument,
  handleGetSettings,
  handleListRecentFiles,
  handleRedo,
  handleUndo,
  handleUpdateSettings
} from '@/app/automation/bridge/app-handlers'
import { createAutomationEvalHandler } from '@/app/automation/bridge/eval-handler'
import { handleExport, handleExportJSX } from '@/app/automation/bridge/export-handlers'
import { createFileHandlers, type AutomationFiles } from '@/app/automation/bridge/file-handlers'
import { handleRPCFallback } from '@/app/automation/bridge/rpc-handler'
import { handleSelection } from '@/app/automation/bridge/selection-handler'
import {
  isUnknownRecord,
  listAutomationDocuments,
  rememberSessionDocument,
  resolveAutomationTarget,
  responseWithTarget,
  stripAutomationTargetArgs,
  type AutomationTarget,
  type UnknownRecord,
  withSessionDocument
} from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/active-store'

type FigmaFactory = (store: EditorStore, pageId?: string, signal?: AbortSignal) => FigmaAPI

/** Runs a command; `signal` aborts once the caller stops waiting, as an MCP timeout does. */
type CommandHandler = (
  target: AutomationTarget,
  args: unknown,
  signal?: AbortSignal
) => Promise<unknown>

export function createAutomationCommandHandlers(makeFigma: FigmaFactory, files?: AutomationFiles) {
  const handleEval = createAutomationEvalHandler(makeFigma)
  const handleTool = createAutomationToolHandler(makeFigma)
  const { handleSaveFile, handleCloseFile, handleNewDocument, handleOpenFile } =
    createFileHandlers(files)

  const commandHandlers: Partial<Record<string, CommandHandler>> = {
    eval: handleEval,
    tool: handleTool,
    export: handleExport,
    export_jsx: handleExportJSX,
    selection: handleSelection,
    save_document: handleSaveFile,
    close_document: handleCloseFile,
    activate_document: handleActivateDocument,
    undo: handleUndo,
    redo: handleRedo
  }

  /** Runs a command on a resolved document page, loading the page first if it was never shown. */
  async function handleTargetCommand(
    target: AutomationTarget,
    command: string,
    args: UnknownRecord,
    signal?: AbortSignal
  ): Promise<unknown> {
    if (!(await target.store.preparePageNodes(target.pageId))) {
      throw new Error(`Page "${target.pageId}" was closed before it finished loading`)
    }
    signal?.throwIfAborted()
    const handler = commandHandlers[command]
    const result = handler
      ? await handler(target, args, signal)
      : await handleRPCFallback(target, command, args)
    return responseWithTarget(result, target)
  }

  async function handleRequest(
    store: EditorStore,
    command: string,
    args: unknown,
    signal?: AbortSignal
  ): Promise<unknown> {
    if (command === 'list_documents') {
      return { ok: true, result: { documents: listAutomationDocuments(store) } }
    }
    if (command === 'list_recent_documents') return handleListRecentFiles()
    if (command === 'agent_session_opened') {
      agentSessionOpened(args)
      return { ok: true, result: null }
    }
    if (command === 'agent_session_closed') {
      const session = isUnknownRecord(args) ? args.session : undefined
      if (typeof session === 'string') endAgentSession(session)
      return { ok: true, result: null }
    }
    if (command === 'get_settings') return handleGetSettings()
    if (command === 'update_settings') return handleUpdateSettings(args)

    const rawArgs = isUnknownRecord(args) ? args : {}
    const session = sessionOf(rawArgs)
    if (command === 'open_document' || command === 'create_document') {
      const response =
        command === 'open_document'
          ? await handleOpenFile(rawArgs)
          : await handleNewDocument(rawArgs)
      rememberSessionDocument(session, response.target)
      return response
    }

    const target = resolveAgentTarget(store, rawArgs)
    // A graph command such as `tree` reads the page it was asked for from its own arguments.
    const commandArgs = commandHandlers[command]
      ? stripAutomationTargetArgs(rawArgs)
      : omit(rawArgs, ['document_id'])
    return handleTargetCommand(target, command, commandArgs, signal)
  }

  return { handleRequest, handleTargetCommand }
}

/**
 * The session whose last document a call that names none goes to: any but an app chat's agent,
 * which has its chat's document instead.
 */
function sessionOf(args: UnknownRecord): string | undefined {
  const agent = readAgentSession(args.agent)
  return agent?.chat === undefined ? agent?.session : undefined
}

/**
 * The document and page a call works on: the one it names; else an app chat's document for the
 * chat's agent, or the document any other session last worked on, so it stays there when
 * another tab comes to the front; else the active one.
 */
function resolveAgentTarget(store: EditorStore, args: UnknownRecord): AutomationTarget {
  // Once an app chat is gone, a late call from its agent must name a document rather than land
  // in whatever tab is in front.
  const chat = readAgentSession(args.agent)?.chat
  const chatStore = agentChatStore(chat)
  const namesDocument = typeof args.document_id === 'string' && args.document_id.length > 0
  if (chat !== undefined && !chatStore && !namesDocument) {
    throw new Error(
      'The chat this agent works for is closed. Pass document_id from list_documents to work on an open document.'
    )
  }
  const session = sessionOf(args)
  const target = resolveAutomationTarget(chatStore ?? store, withSessionDocument(session, args))
  rememberSessionDocument(session, target)
  return target
}
