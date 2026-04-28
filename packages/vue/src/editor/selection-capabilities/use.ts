import { useSelectionState } from '#vue/editor/selection-state/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { computed } from 'vue'

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
    canUngroup: computed(() => selection.isGroup.value),
    canCreateComponent: computed(() => hasSelection.value),
    canCreateComponentSet: selection.canCreateComponentSet,
    canDetachInstance: computed(() => selection.isInstance.value),
    canWrapInAutoLayout: computed(() => hasSelection.value),
    canBringToFront: computed(() => hasSelection.value),
    canSendToBack: computed(() => hasSelection.value),
    canToggleVisibility: computed(() => hasSelection.value),
    canToggleLock: computed(() => hasSelection.value),
    canGoToMainComponent: computed(() => selection.isInstance.value),
    canCreateInstance: computed(() => selectedNode.value?.type === 'COMPONENT'),
    canMoveToPage: useSceneComputed(() => hasSelection.value && editor.graph.getPages().length > 1),
    canSelectAll: useSceneComputed(
      () => editor.graph.getChildren(editor.state.currentPageId).length > 0
    ),
    canUndo: useSceneComputed(() => editor.undo.canUndo),
    canRedo: useSceneComputed(() => editor.undo.canRedo),
    canZoomToSelection: computed(() => hasSelection.value)
  }
}
