import { renderTreeNode } from '@open-pencil/core/design-jsx'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { JsonObject } from '@open-pencil/scene-graph/primitives'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { ensureGraphFonts } from '@/app/editor/fonts'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationToolHandler(makeFigma: FigmaFactory) {
  async function handleToolRender(
    target: AutomationTarget,
    toolArgs: Record<string, unknown>
  ): Promise<unknown> {
    const store = target.store
    const tree = toolArgs.tree as Parameters<typeof renderTreeNode>[1]
    const result = await renderTreeNode(store.graph, tree, {
      parentId: (toolArgs.parent_id as string | undefined) ?? target.pageId,
      x: toolArgs.x as number | undefined,
      y: toolArgs.y as number | undefined
    })
    await ensureGraphFonts(store.graph, [result.id])
    computeAllLayouts(store.graph, target.pageId)
    store.requestRender()
    store.flashNodes([result.id])
    return {
      ok: true,
      result: { id: result.id, name: result.name, type: result.type, children: result.childIds }
    }
  }

  return async function handleTool(target: AutomationTarget, args: unknown): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const toolArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')

    if (toolName === 'render' && toolArgs.tree) {
      return handleToolRender(target, toolArgs)
    }

    const def = ALL_TOOLS.find((t) => t.name === toolName)
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const store = target.store
    const figma = makeFigma(store, target.pageId)
    const result = await def.execute(figma, toolArgs)

    if (def.mutates) {
      const pageNode = store.graph.getNode(figma.currentPageId)
      if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds)
      computeAllLayouts(store.graph, figma.currentPageId)
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { ok: true, result }
  }
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as JsonObject
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (item && typeof item === 'object' && typeof (item as JsonObject).id === 'string')
        ids.push((item as JsonObject).id as string)
    }
  }
  return ids
}
