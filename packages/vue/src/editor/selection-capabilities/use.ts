import { computed, shallowRef } from 'vue'

import { canMakeBooleanSourceNode, layersToOutline } from '@open-pencil/core/canvas'

import { useEditorEvent } from '#vue/editor/events/use'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/**
 * Returns reactive booleans describing which selection-dependent actions are
 * currently available.
 *
 * This is useful for menus, toolbars, shortcuts, and action buttons that need
 * command-friendly capability checks.
 */
export function useSelectionCapabilities() {
  const selection = useSelectionState()
  const { editor, selectedIds, selectedNode, selectedCount, hasSelection } = selection
  // A change counter, not the undo manager itself: an editor that follows the active document
  // must answer for the document that is active now.
  const historyVersion = shallowRef(0)
  useEditorEvent('history:changed', () => {
    historyVersion.value++
  })

  const selectedNodesCanFlatten = useSceneComputed(() => {
    const nodes = editor.getSelectedNodes()
    return nodes.length > 0 && nodes.every((node) => canMakeBooleanSourceNode(node, editor.graph))
  })

  return {
    selectedIds,
    selectedNode,
    canCopy: computed(() => hasSelection.value),
    canCut: computed(() => hasSelection.value),
    canPaste: computed(() => true),
    canDelete: computed(() => hasSelection.value),
    canDuplicate: computed(() => hasSelection.value),
    canExportSelection: computed(() => hasSelection.value),
    canGroup: computed(() => selectedCount.value >= 2),
    canFrameSelection: computed(() => hasSelection.value),
    canWrapInSection: useSceneComputed(() => editor.canWrapSelectionInSection()),
    canUngroup: computed(() => selection.isGroup.value),
    canCreateComponent: computed(() => hasSelection.value),
    canCreateComponentSet: selection.canCreateComponentSet,
    canDetachInstance: computed(() => selection.isInstance.value),
    canDetachIcon: computed(() => selection.isIcon.value),
    canWrapInAutoLayout: computed(() => hasSelection.value),
    canToggleMask: computed(() => hasSelection.value),
    canBringToFront: computed(() => hasSelection.value),
    canSendToBack: computed(() => hasSelection.value),
    canToggleVisibility: computed(() => hasSelection.value),
    canToggleLock: computed(() => hasSelection.value),
    canFlip: computed(() => hasSelection.value),
    canDistribute: useSceneComputed(() => editor.canDistributeNodes([...editor.state.selectedIds])),
    canArrange: useSceneComputed(() => editor.canArrangeNodes([...editor.state.selectedIds])),
    canAutoArrange: useSceneComputed(() =>
      editor.canAutoArrangeNodes([...editor.state.selectedIds])
    ),
    canBooleanOperation: computed(() => selectedCount.value >= 2 && selectedNodesCanFlatten.value),
    canFlatten: computed(() => selectedNodesCanFlatten.value),
    canOutlineText: useSceneComputed(() => {
      const nodes = editor.getSelectedNodes()
      return (
        nodes.length > 0 &&
        nodes.every((node) => node.type === 'TEXT' && canMakeBooleanSourceNode(node, editor.graph))
      )
    }),
    canOutlineStroke: useSceneComputed(
      () => layersToOutline(editor.getSelectedNodes(), editor.graph).length > 0
    ),
    canGoToMainComponent: computed(() => selection.isInstance.value),
    canCreateInstance: computed(() => selectedNode.value?.type === 'COMPONENT'),
    canCreateSlot: selection.canCreateSlot,
    canMoveToPage: useSceneComputed(() => hasSelection.value && editor.graph.getPages().length > 1),
    canSelectAll: useSceneComputed(
      () => editor.graph.getChildren(editor.state.currentPageId).length > 0
    ),
    // A pen point or a path change not yet recorded becomes a step when undo runs, so undo stays
    // on while the pen draws or a path is open.
    canUndo: useSceneComputed(
      () =>
        historyVersion.value >= 0 &&
        (editor.state.penState != null || editor.state.nodeEditState != null || editor.undo.canUndo)
    ),
    canRedo: useSceneComputed(() => historyVersion.value >= 0 && editor.undo.canRedo),
    canZoomToSelection: computed(() => hasSelection.value)
  }
}
