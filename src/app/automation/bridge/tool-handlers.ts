import { renderTreeNode } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { ALL_TOOLS } from '@open-pencil/core/tools'

import type { EditorStore } from '@/app/editor/active-store'
import type { FigmaAPI } from '@open-pencil/core/figma-api'

type FigmaFactory = () => FigmaAPI

export function createAutomationToolHandler(makeFigma: FigmaFactory) {
  async function handleToolRender(
    store: EditorStore,
    toolArgs: Record<string, unknown>
  ): Promise<unknown> {
    const tree = toolArgs.tree as Parameters<typeof renderTreeNode>[1]
    const result = await renderTreeNode(store.graph, tree, {
      parentId: (toolArgs.parent_id as string | undefined) ?? store.state.currentPageId,
      x: toolArgs.x as number | undefined,
      y: toolArgs.y as number | undefined
    })
    computeAllLayouts(store.graph, store.state.currentPageId)
    store.requestRender()
    store.flashNodes([result.id])
    return {
      ok: true,
      result: { id: result.id, name: result.name, type: result.type, children: result.childIds }
    }
  }

  return async function handleTool(store: EditorStore, args: unknown): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const toolArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')

    if (toolName === 'render' && toolArgs.tree) {
      return handleToolRender(store, toolArgs)
    }

    const def = ALL_TOOLS.find((t) => t.name === toolName)
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const figma = makeFigma()
    const result = await def.execute(figma, toolArgs)

    if (figma.currentPageId !== store.state.currentPageId) {
      void store.switchPage(figma.currentPageId)
    }

    if (def.mutates) {
      computeAllLayouts(store.graph, store.state.currentPageId)
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { ok: true, result }
  }
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as Record<string, unknown>
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string'
      )
        ids.push((item as Record<string, unknown>).id as string)
    }
  }
  return ids
}
