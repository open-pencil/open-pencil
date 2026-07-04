import type { FigmaAPI } from '@open-pencil/core/figma-api'

import { createAutomationEvalHandler } from '@/app/automation/bridge/eval-handler'
import { handleExport, handleExportJsx } from '@/app/automation/bridge/export-handlers'
import {
  handleNewDocument,
  handleOpenFile,
  handleSaveFile
} from '@/app/automation/bridge/file-handlers'
import { handleRpcFallback } from '@/app/automation/bridge/rpc-handler'
import { handleSelection } from '@/app/automation/bridge/selection-handler'
import {
  isUnknownRecord,
  listAutomationDocuments,
  resolveAutomationTarget,
  responseWithTarget,
  stripAutomationTargetArgs
} from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/active-store'

type FigmaFactory = (store: EditorStore, pageId?: string) => FigmaAPI

type CommandHandler = (
  target: ReturnType<typeof resolveAutomationTarget>,
  args: unknown
) => Promise<unknown>

export function createAutomationCommandHandlers(makeFigma: FigmaFactory) {
  const handleEval = createAutomationEvalHandler(makeFigma)
  const handleTool = createAutomationToolHandler(makeFigma)

  const commandHandlers: Partial<Record<string, CommandHandler>> = {
    eval: handleEval,
    tool: handleTool,
    export: handleExport,
    export_jsx: handleExportJsx,
    selection: handleSelection,
    save_file: handleSaveFile,
    new_document: handleNewDocument,
    open_file: handleOpenFile
  }

  async function handleRequest(
    store: EditorStore,
    command: string,
    args: unknown
  ): Promise<unknown> {
    if (command === 'list_documents') {
      return { ok: true, result: { documents: listAutomationDocuments(store) } }
    }

    if (command === 'open_file' || command === 'new_document') {
      const handler = commandHandlers[command]
      if (handler) return handler(resolveAutomationTarget(store, undefined), args)
    }

    const rawArgs = isUnknownRecord(args) ? args : {}
    const target = resolveAutomationTarget(store, rawArgs)
    const targetArgs = stripAutomationTargetArgs(rawArgs)
    const handler = commandHandlers[command]
    const result = handler
      ? await handler(target, targetArgs)
      : await handleRpcFallback(target, command, targetArgs)
    return responseWithTarget(result, target)
  }

  return { handleRequest }
}
