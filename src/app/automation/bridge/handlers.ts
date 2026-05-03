import { createAutomationEvalHandler } from '@/app/automation/bridge/eval-handler'
import { handleExport, handleExportJsx } from '@/app/automation/bridge/export-handlers'
import {
  handleNewDocument,
  handleOpenFile,
  handleSaveFile
} from '@/app/automation/bridge/file-handlers'
import { handleRpcFallback } from '@/app/automation/bridge/rpc-handler'
import { handleSelection } from '@/app/automation/bridge/selection-handler'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'

import type { EditorStore } from '@/app/editor/active-store'
import type { FigmaAPI } from '@open-pencil/core/figma-api'

type FigmaFactory = () => FigmaAPI

type CommandHandler = (store: EditorStore, args: unknown) => Promise<unknown>

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
    const handler = commandHandlers[command]
    if (handler) return handler(store, args)
    return handleRpcFallback(store, command, args)
  }

  return { handleRequest }
}
