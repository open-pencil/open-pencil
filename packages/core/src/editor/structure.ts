import type { SceneNode } from '@open-pencil/scene-graph'

import { acceptingParent, acceptsChildren, prepareSlotEdits } from '#core/editor/components/slots'
import { fitEnclosingGroupsWithUndo } from '#core/editor/structure/group-bounds'

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

  /** Moves layers under a new parent; refuses the locked part of an instance. */
  function reparentNodes(nodeIds: string[], newParentId: string): boolean {
    const parent = ctx.graph.getNode(newParentId)
    // Sections only go into pages and other sections.
    const movable = nodeIds.filter(
      (id) =>
        ctx.graph.getNode(id)?.type !== 'SECTION' ||
        !parent ||
        parent.type === 'CANVAS' ||
        parent.type === 'SECTION'
    )
    if (movable.length === 0) return true
    const parents = new Set([newParentId])
    for (const id of movable) {
      const current = ctx.graph.getNode(id)?.parentId
      if (current && current !== newParentId) parents.add(current)
    }
    if (!prepareSlotEdits(ctx, parents)) return false
    for (const id of movable) ctx.graph.reparentNode(id, newParentId)
    return true
  }

  function wrapSelectionInContainer(
    containerType: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
    selectedNodes: SceneNode[],
    extraProps?: Partial<SceneNode>
  ) {
    return wrapSelectionInContainerImpl(ctx, containerType, selectedNodes, extraProps)
  }

  function wrapInAutoLayout(selectedNodes: SceneNode[]) {
    return wrapInAutoLayoutImpl(ctx, selectedNodes)
  }

  function groupSelected(selectedNodes: SceneNode[]) {
    return wrapSelectionInContainer('GROUP', selectedNodes)
  }

  /** Figma frames a selection without a fill or clipping, unlike a drawn frame. */
  function frameSelection(selectedNodes: SceneNode[]) {
    return wrapSelectionInContainer('FRAME', selectedNodes)
  }

  /**
   * Turns a group into a frame in place. The layer keeps its id, children, bounds and look: a
   * group has no fill and does not clip, and the frame starts the same way.
   */
  function convertGroupToFrame(nodeId: string) {
    if (ctx.graph.getNode(nodeId)?.type !== 'GROUP') return
    const apply = (type: 'GROUP' | 'FRAME') => {
      ctx.graph.updateNode(nodeId, { type })
      ctx.runLayoutForNode(nodeId)
    }
    apply('FRAME')
    ctx.undo.push({
      label: 'Convert to frame',
      forward: () => apply('FRAME'),
      inverse: () => apply('GROUP')
    })
  }

  function booleanOperationSelected(selectedNodes: SceneNode[], operation: BooleanOperation) {
    return booleanOperationSelectedImpl(ctx, selectedNodes, operation)
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
    acceptsChildren: (parentId: string) => acceptsChildren(ctx, parentId),
    acceptingParent: (parentId: string) => acceptingParent(ctx, parentId),
    fitEnclosingGroups: (parentIds: Iterable<string>) => fitEnclosingGroupsWithUndo(ctx, parentIds),
    ...reorderActions,
    reparentNodes,
    wrapSelectionInContainer,
    wrapInAutoLayout,
    groupSelected,
    frameSelection,
    convertGroupToFrame,
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
