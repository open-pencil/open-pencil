import { wrapInAutoLayout as wrapInAutoLayoutImpl } from './structure/auto-layout-wrap'
import { wrapSelectionInContainer as wrapSelectionInContainerImpl } from './structure/container-wrap'
import { ungroupSelected as ungroupImpl } from './structure/group'
import { createStructureReorderActions } from './structure/reorder'
import { createStructureStateActions } from './structure/state'

import type { NodeType, SceneNode } from '#core/scene-graph'
import type { EditorContext } from './types'

export function createStructureActions(ctx: EditorContext) {
  const reorderActions = createStructureReorderActions(ctx)
  const stateActions = createStructureStateActions(ctx)
  function defaultNodeName(type: NodeType): string {
    return type.charAt(0) + type.slice(1).toLowerCase()
  }

  function isTopLevel(parentId: string | null): boolean {
    return !parentId || parentId === ctx.graph.rootId || parentId === ctx.state.currentPageId
  }

  function reparentNodes(nodeIds: string[], newParentId: string) {
    const parent = ctx.graph.getNode(newParentId)
    for (const id of nodeIds) {
      const node = ctx.graph.getNode(id)
      if (
        node?.type === 'SECTION' &&
        parent &&
        parent.type !== 'CANVAS' &&
        parent.type !== 'SECTION'
      )
        continue
      ctx.graph.reparentNode(id, newParentId)
    }
  }

  function wrapSelectionInContainer(
    containerType: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
    selectedNodes: SceneNode[],
    extraProps?: Partial<SceneNode>
  ) {
    return wrapSelectionInContainerImpl(ctx, isTopLevel, containerType, selectedNodes, extraProps)
  }

  function wrapInAutoLayout(selectedNodes: SceneNode[]) {
    wrapInAutoLayoutImpl(ctx, isTopLevel, selectedNodes)
  }

  function groupSelected(selectedNodes: SceneNode[]) {
    return wrapSelectionInContainer('GROUP', selectedNodes)
  }

  function ungroupSelected(selectedNode: SceneNode | undefined) {
    ungroupImpl(ctx, selectedNode)
  }

  function moveToPage(pageId: string) {
    const targetPage = ctx.graph.getNode(pageId)
    if (targetPage?.type !== 'CANVAS') return
    const ids = [...ctx.state.selectedIds]
    for (const id of ids) {
      ctx.graph.reparentNode(id, pageId)
    }
    ctx.state.selectedIds = new Set()
  }

  function renameNode(id: string, name: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    const trimmedName = name.trim()
    ctx.graph.updateNode(id, { name: trimmedName || defaultNodeName(node.type) })
  }

  return {
    isTopLevel,
    ...reorderActions,
    reparentNodes,
    wrapSelectionInContainer,
    wrapInAutoLayout,
    groupSelected,
    ungroupSelected,
    ...stateActions,
    moveToPage,
    renameNode
  }
}
