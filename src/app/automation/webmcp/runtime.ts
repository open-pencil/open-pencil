import { runEditorTool } from '@/app/ai/tools/runner'
import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { resolveAutomationTarget } from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/active-store'
import { getTabById } from '@/app/tabs'

import { webmcpMode } from './preferences'
import { createWebMCPRuntimeService } from './service'

const service = createWebMCPRuntimeService()
export const webmcpRuntime = service.state

/** Browser-native tools reuse the same editor targeting and handlers as remote MCP. */
export function startWebMCP(getStore: () => EditorStore): () => void {
  const handleTool = createAutomationToolHandler(makeFigmaFromStore)
  return service.start(
    typeof document === 'undefined' ? undefined : document.modelContext,
    webmcpMode,
    () => {
      const target = resolveAutomationTarget(getStore(), undefined)
      if (getTabById(target.documentId)?.kind !== 'document') {
        throw new Error('Open a document before using WebMCP tools')
      }
      return {
        execute: async (def, args, signal) => {
          signal.throwIfAborted()
          if (def.mutates) {
            return {
              ok: true,
              result: await runEditorTool({
                store: target.store,
                figma: makeFigmaFromStore(target.store, target.pageId),
                def,
                args,
                source: 'WebMCP',
                signal,
                isLive: () => getTabById(target.documentId)?.store === target.store
              })
            }
          }
          return handleTool(target, { name: def.name, args })
        }
      }
    }
  )
}
