import { pick } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import { TRANSFORM_FIELDS } from '@open-pencil/scene-graph/fields'
import { generatedFrameKind } from '@open-pencil/scene-graph/generated'
import { createsComponentCycle } from '@open-pencil/scene-graph/instances'

import { acceptingParent, acceptsChildren, prepareSlotEdits } from '#core/editor/components/slots'
import { fitEnclosingGroupsWithUndo } from '#core/editor/structure/group/bounds'

import { layerTheme, newLayerDefaults } from './shapes/defaults'
import { wrapInAutoLayout as wrapInAutoLayoutImpl } from './structure/auto-layout-wrap'
import {
  booleanOperationSelected as booleanOperationSelectedImpl,
  type BooleanOperation
} from './structure/boolean'
import {
  sharedParentId,
  wrapSelectionInContainer as wrapSelectionInContainerImpl
} from './structure/container-wrap'
import { flattenSelected as flattenSelectedImpl } from './structure/flatten'
import { ungroupSelected as ungroupImpl } from './structure/group/ungroup'
import { createLayerTypeActions } from './structure/layer-type'
import { outlineStrokeSelected as outlineStrokeSelectedImpl } from './structure/outline-stroke'
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
  const layerTypeActions = createLayerTypeActions(ctx)

  function isTopLevel(parentId: string | null): boolean {
    return !parentId || parentId === ctx.graph.rootId || parentId === ctx.state.currentPageId
  }

  /**
   * Moves layers under a new parent; refuses the locked part of an instance, and a layer that
   * would make a component contain itself, as Figma does.
   */
  function reparentNodes(nodeIds: string[], newParentId: string): boolean {
    const parent = ctx.graph.getNode(newParentId)
    // Sections only go into pages and other sections.
    const movable = nodeIds.filter(
      (id) =>
        (ctx.graph.getNode(id)?.type !== 'SECTION' ||
          !parent ||
          parent.type === 'CANVAS' ||
          parent.type === 'SECTION') &&
        !createsComponentCycle(ctx.graph, id, newParentId)
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
   * Whether layers can go in a new section: siblings on a page or in a section, where sections
   * live. Toolbars ask while they draw, so it reads the parent without claiming anything.
   */
  function canWrapInSection(selectedNodes: SceneNode[]) {
    const parentId = sharedParentId(ctx, selectedNodes)
    const parent = parentId ? ctx.graph.getNode(parentId) : undefined
    return parent?.type === 'CANVAS' || parent?.type === 'SECTION'
  }

  /**
   * Wraps layers in a new section with room around them, as FigJam's selection toolbar does,
   * painted as a drawn section is.
   */
  function wrapInSection(selectedNodes: SceneNode[]) {
    if (!canWrapInSection(selectedNodes)) return null
    return wrapSelectionInContainerImpl(
      ctx,
      'SECTION',
      selectedNodes,
      newLayerDefaults('SECTION', layerTheme(ctx.state))
    )
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
    // Where each layer was, read before any of them moves: put back in this order, each lands at
    // its own index again.
    const origins = [...ctx.state.selectedIds]
      .flatMap((id) => {
        const node = ctx.graph.getNode(id)
        const parent = node?.parentId ? ctx.graph.getNode(node.parentId) : undefined
        if (!node || !parent || parent.id === pageId) return []
        const index = parent.childIds.indexOf(id)
        return [{ id, parentId: parent.id, index, place: pick(node, TRANSFORM_FIELDS) }]
      })
      .sort((a, b) => a.index - b.index)
    if (origins.length === 0) return
    const parentIds = new Set(origins.map((origin) => origin.parentId))
    const move = () => {
      for (const { id } of origins) ctx.graph.reparentNode(id, pageId)
      for (const parentId of parentIds) ctx.runLayoutForNode(parentId)
    }
    move()
    ctx.setSelectedIds(new Set())
    ctx.undo.push({
      label: 'Move to page',
      forward: move,
      inverse: () => {
        for (const { id, parentId, index, place } of origins) {
          ctx.graph.insertChildAt(id, parentId, index)
          ctx.graph.updateNode(id, place)
        }
        for (const parentId of parentIds) ctx.runLayoutForNode(parentId)
      }
    })
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
    const previous = { name: node.name, autoRename: node.autoRename }
    const next = name.trim() || defaultNodeName(node.type)
    if (next === previous.name) return
    // A layer named by its text, as a sticky note is, keeps the name it is given, as in FigJam.
    const namedByText = generatedFrameKind(node)?.namedByText ?? false
    const renamed = { name: next, autoRename: namedByText ? false : node.autoRename }
    ctx.graph.updateNode(id, renamed)
    ctx.undo.push({
      label: 'Rename',
      forward: () => ctx.graph.updateNode(id, renamed),
      inverse: () => ctx.graph.updateNode(id, previous)
    })
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
    canWrapInSection,
    wrapInSection,
    ...layerTypeActions,
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
