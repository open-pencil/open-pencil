import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FRAME_FILL } from '#core/constants'

import { wrapInAutoLayout as wrapInAutoLayoutImpl } from './structure/auto-layout-wrap'
import {
  booleanOperationSelected as booleanOperationSelectedImpl,
  type BooleanOperation
} from './structure/boolean'
import { wrapSelectionInContainer as wrapSelectionInContainerImpl } from './structure/container-wrap'
import {
  flattenSelected as flattenSelectedImpl,
  outlineStrokeSelected as outlineStrokeSelectedImpl
} from './structure/flatten'
import { ungroupSelected as ungroupImpl } from './structure/group'
import {
  defaultNodeName,
  previewRenamedNodes,
  type RenameSelectionOptions
} from './structure/rename'
import { createStructureReorderActions } from './structure/reorder'
import { createStructureStateActions } from './structure/state'
import type { EditorContext } from './types'

export function createStructureActions(ctx: EditorContext) {
  const reorderActions = createStructureReorderActions(ctx)
  const stateActions = createStructureStateActions(ctx)

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

  function frameSelection(selectedNodes: SceneNode[]) {
    return wrapSelectionInContainer('FRAME', selectedNodes, {
      fills: [structuredClone(DEFAULT_FRAME_FILL)]
    })
  }

  function booleanOperationSelected(selectedNodes: SceneNode[], operation: BooleanOperation) {
    return booleanOperationSelectedImpl(ctx, isTopLevel, selectedNodes, operation)
  }

  function ungroupSelected(selectedNode: SceneNode | undefined) {
    ungroupImpl(ctx, selectedNode)
  }

  function flattenSelected(selectedNodes: SceneNode[]) {
    return flattenSelectedImpl(ctx, selectedNodes)
  }

  function outlineTextSelected(selectedNodes: SceneNode[]) {
    if (selectedNodes.length === 0 || selectedNodes.some((node) => node.type !== 'TEXT'))
      return null
    return flattenSelectedImpl(ctx, selectedNodes, { label: 'Outline text' })
  }

  function outlineStrokeSelected(selectedNodes: SceneNode[]) {
    return outlineStrokeSelectedImpl(ctx, selectedNodes)
  }

  function moveToPage(pageId: string) {
    const targetPage = ctx.graph.getNode(pageId)
    if (targetPage?.type !== 'CANVAS') return
    const ids = [...ctx.state.selectedIds]
    for (const id of ids) {
      ctx.graph.reparentNode(id, pageId)
    }
    ctx.setSelectedIds(new Set())
  }

  function selectedNodes(): SceneNode[] {
    return [...ctx.state.selectedIds]
      .map((id) => ctx.graph.getNode(id))
      .filter((node): node is SceneNode => node != null)
  }

  function previewRenameSelected(options: RenameSelectionOptions) {
    return previewRenamedNodes(selectedNodes(), options)
  }

  function renameSelected(options: RenameSelectionOptions) {
    const nodes = selectedNodes()
    if (nodes.length === 0) return
    const before = new Map(nodes.map((node) => [node.id, node.name]))
    const preview = previewRenamedNodes(nodes, options)
    if (preview.error) return
    const applyNames = (names: ReadonlyMap<string, string>) => {
      for (const [id, nextName] of names) ctx.graph.updateNode(id, { name: nextName })
    }

    applyNames(preview.names)
    ctx.undo.push({
      label: 'Rename selection',
      forward: () => applyNames(preview.names),
      inverse: () => applyNames(before)
    })
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
    frameSelection,
    booleanOperationSelected,
    ungroupSelected,
    flattenSelected,
    outlineTextSelected,
    outlineStrokeSelected,
    ...stateActions,
    moveToPage,
    previewRenameSelected,
    renameSelected,
    renameNode
  }
}
