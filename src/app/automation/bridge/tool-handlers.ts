import { renderTree } from '@open-pencil/core/design-jsx'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  ALL_TOOLS,
  registerComponentCatalog,
  isAtomicTool,
  isToolExposed,
  toolChangesDocument
} from '@open-pencil/core/tools'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import {
  agentFinished,
  agentStarted,
  readAgentSession,
  touchedNodeIds
} from '@/app/automation/agents'
import { limitToSelection } from '@/app/automation/bridge/selection-scope'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import {
  AUTOMATION_UNDO_LABEL,
  automationUndoLabel,
  executeAtomicEditorTool,
  executeWithPageUndo
} from '@/app/automation/execution/editor'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationToolHandler(makeFigma: FigmaFactory) {
  async function handleToolRender(
    target: AutomationTarget,
    toolArgs: Record<string, unknown>
  ): Promise<{ id: string; name: string; type: string; children: string[] }> {
    const store = target.store
    const tree = toolArgs.tree as Parameters<typeof renderTree>[1]
    const parentId = (toolArgs.parent_id as string | undefined) ?? target.pageId
    // A parent on another page puts the new layers there, so that page's history records them.
    const undoPageId = pageIdOf(store.graph, parentId) ?? target.pageId
    const result = await executeWithPageUndo(store, undoPageId, automationUndoLabel('render'), () =>
      store.runMutationWithLayout(
        () =>
          renderTree(store.graph, tree, {
            parentId,
            x: toolArgs.x as number | undefined,
            y: toolArgs.y as number | undefined
          }),
        target.pageId,
        async (node) => {
          await ensureGraphFonts(store.graph, [node.id], store.renderer)
        }
      )
    )
    store.requestRender()
    store.flashNodes([result.id])
    return { id: result.id, name: result.name, type: result.type, children: result.childIds }
  }

  return async function handleTool(target: AutomationTarget, args: unknown): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const requestedArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')
    // An MCP server that shares only the selection marks its calls, and they stay inside it.
    const toolArgs =
      (args as { scope?: unknown }).scope === 'selection'
        ? limitToSelection(target.store, toolName, requestedArgs)
        : requestedArgs

    // A call from an MCP session shows as that session's agent, working where the call works.
    const session = readAgentSession((args as { agent?: unknown }).agent)
    if (session) agentStarted(target.store, session, target.pageId)
    const response = await runTool(target, toolName, toolArgs)
    if (session) {
      agentFinished(target.store, session, {
        pageId: target.pageId,
        nodeIds: touchedNodeIds(target.store, toolArgs, response.result),
        edited: response.edited
      })
    }
    return { ok: true, result: response.result }
  }

  async function runTool(
    target: AutomationTarget,
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<{ result: unknown; edited: boolean }> {
    if (toolName === 'render' && toolArgs.tree) {
      return { result: await handleToolRender(target, toolArgs), edited: true }
    }

    const def = ALL_TOOLS.find((t) => t.name === toolName && isToolExposed(t, 'mcp'))
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const store = target.store
    const libraryService = useLibraryService()
    libraryService.bindEditor(store)
    registerComponentCatalog(store.graph, libraryService)
    const figma = makeFigma(store, target.pageId)
    let result: unknown
    if (isAtomicTool(def)) {
      result = await executeAtomicEditorTool(store, figma, def, toolArgs, {
        label: AUTOMATION_UNDO_LABEL
      })
    } else if (def.mutates) {
      const pageId = figma.currentPageId
      const mutate = () =>
        store.runMutationWithLayout(
          () => def.execute(figma, toolArgs),
          figma.currentPageId,
          async () => {
            const pageNode = store.graph.getNode(figma.currentPageId)
            if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
          }
        )
      // View tools (selection, viewport, pages) leave the document and its history alone.
      result = toolChangesDocument(def)
        ? await executeWithPageUndo(store, pageId, automationUndoLabel(def.name), mutate)
        : await mutate()
    } else {
      result = await def.execute(figma, toolArgs)
    }

    if (def.mutates) {
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { result, edited: def.mutates }
  }
}

function pageIdOf(graph: AutomationTarget['store']['graph'], nodeId: string): string | null {
  let node = graph.getNode(nodeId)
  while (node && node.type !== 'CANVAS')
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  return node?.id ?? null
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as JSONObject
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (item && typeof item === 'object' && typeof (item as JSONObject).id === 'string')
        ids.push((item as JSONObject).id as string)
    }
  }
  return ids
}
