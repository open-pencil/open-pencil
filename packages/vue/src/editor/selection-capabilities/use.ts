import { computed } from 'vue'

import { canMakeBooleanSourceNode, hasVisibleStrokeSourceNode } from '@open-pencil/core/canvas'

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
    canUngroup: computed(() => selection.isGroup.value),
    canCreateComponent: computed(() => hasSelection.value),
    canCreateComponentSet: selection.canCreateComponentSet,
    canDetachInstance: computed(() => selection.isInstance.value),
    canWrapInAutoLayout: computed(() => hasSelection.value),
    canBringToFront: computed(() => hasSelection.value),
    canSendToBack: computed(() => hasSelection.value),
    canToggleVisibility: computed(() => hasSelection.value),
    canToggleLock: computed(() => hasSelection.value),
    canFlip: computed(() => hasSelection.value),
    canBooleanOperation: computed(() => selectedCount.value >= 2 && selectedNodesCanFlatten.value),
    canFlatten: computed(() => selectedNodesCanFlatten.value),
    canOutlineText: useSceneComputed(() => {
      const nodes = editor.getSelectedNodes()
      return (
        nodes.length > 0 &&
        nodes.every((node) => node.type === 'TEXT' && canMakeBooleanSourceNode(node, editor.graph))
      )
    }),
    canOutlineStroke: useSceneComputed(() => {
      const nodes = editor.getSelectedNodes()
      return (
        nodes.length > 0 &&
        nodes.every(
          (node) =>
            hasVisibleStrokeSourceNode(node, editor.graph) &&
            canMakeBooleanSourceNode(node, editor.graph)
        )
      )
    }),
    canGoToMainComponent: computed(() => selection.isInstance.value),
    canCreateInstance: computed(() => selectedNode.value?.type === 'COMPONENT'),
    canMoveToPage: useSceneComputed(() => hasSelection.value && editor.graph.getPages().length > 1),
    canSelectAll: useSceneComputed(
      () => editor.graph.getChildren(editor.state.currentPageId).length > 0
    ),
    // In vector edit mode, undo/redo route to the session-local history —
    // keep the commands enabled so the shortcut reaches them.
    canUndo: useSceneComputed(() => editor.state.nodeEditState != null || editor.undo.canUndo),
    canRedo: useSceneComputed(() => editor.state.nodeEditState != null || editor.undo.canRedo),
    canZoomToSelection: computed(() => hasSelection.value)
  }
}
