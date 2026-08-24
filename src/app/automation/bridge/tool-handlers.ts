import { renderTreeNode } from '@open-pencil/core/design-jsx'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { ALL_TOOLS, registerComponentCatalog } from '@open-pencil/core/tools'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

function findOwningPageId(target: AutomationTarget, nodeId: string): string | null {
  let node = target.store.graph.getNode(nodeId)
  while (node) {
    if (node.type === 'CANVAS') return node.id
    node = node.parentId ? target.store.graph.getNode(node.parentId) : undefined
  }
  return null
}

export async function prepareRasterExportTarget(
  target: AutomationTarget,
  toolArgs: Record<string, unknown>
): Promise<void> {
  const ids = Array.isArray(toolArgs.ids)
    ? toolArgs.ids.filter((id): id is string => typeof id === 'string')
    : []
  const pageIds = new Set(ids.map((id) => findOwningPageId(target, id)).filter(Boolean))
  if (pageIds.size > 1) throw new Error('Export selection must stay on a single page')
  const nodePageId = pageIds.values().next().value
  if (nodePageId) target.pageId = nodePageId
  if (target.store.state.currentPageId !== target.pageId) {
    await target.store.switchPage(target.pageId)
  }
  const page = target.store.graph.getNode(target.pageId)
  if (page?.type !== 'CANVAS') throw new Error(`Page "${target.pageId}" not found`)
  target.pageName = page.name
}

export async function syncPageSwitchToEditor(
  target: AutomationTarget,
  figma: FigmaAPI,
  result: unknown
): Promise<boolean> {
  if (!result || typeof result !== 'object' || 'error' in result) return false
  await target.store.switchPage(figma.currentPageId)
  const page = target.store.graph.getNode(figma.currentPageId)
  target.pageId = figma.currentPageId
  target.pageName = page?.name ?? target.pageName
  return true
}

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
    await ensureGraphFonts(store.graph, [result.id], store.renderer)
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
    if (toolName === 'export_image') await prepareRasterExportTarget(target, toolArgs)
    const libraryService = useLibraryService()
    libraryService.bindEditor(store)
    registerComponentCatalog(store.graph, libraryService)
    const figma = makeFigma(store, target.pageId)
    const result = await def.execute(figma, toolArgs)

    if (toolName === 'switch_page' && (await syncPageSwitchToEditor(target, figma, result))) {
      return { ok: true, result }
    }

    if (def.mutates) {
      const pageNode = store.graph.getNode(figma.currentPageId)
      if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
      computeAllLayouts(store.graph, figma.currentPageId)
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { ok: true, result }
  }
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
