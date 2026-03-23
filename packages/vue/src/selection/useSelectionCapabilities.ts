import { computed } from 'vue'

import { useSelectionState } from '../selection/useSelectionState'

export function useSelectionCapabilities() {
  const {
    editor,
    selectedIds,
    selectedNode,
    selectedCount,
    hasSelection,
    isInstance,
    isGroup,
    canCreateComponentSet
  } = useSelectionState()

  const canCopy = computed(() => hasSelection.value)
  const canCut = computed(() => hasSelection.value)
  const canDelete = computed(() => hasSelection.value)
  const canDuplicate = computed(() => hasSelection.value)
  const canExportSelection = computed(() => hasSelection.value)
  const canGroup = computed(() => selectedCount.value >= 2)
  const canUngroup = computed(() => isGroup.value)
  const canCreateComponent = computed(() => hasSelection.value)
  const canDetachInstance = computed(() => isInstance.value)
  const canWrapInAutoLayout = computed(() => hasSelection.value)
  const canBringToFront = computed(() => hasSelection.value)
  const canSendToBack = computed(() => hasSelection.value)
  const canToggleVisibility = computed(() => hasSelection.value)
  const canToggleLock = computed(() => hasSelection.value)
  const canGoToMainComponent = computed(() => isInstance.value)
  const canCreateInstance = computed(() => selectedNode.value?.type === 'COMPONENT')
  const canMoveToPage = computed(() => hasSelection.value && editor.graph.getPages().length > 1)
  const canPaste = computed(() => true)
  const canSelectAll = computed(
    () => editor.graph.getChildren(editor.state.currentPageId).length > 0
  )
  const canUndo = computed(() => editor.undo.canUndo)
  const canRedo = computed(() => editor.undo.canRedo)
  const canZoomToSelection = computed(() => hasSelection.value)

  return {
    selectedIds,
    selectedNode,
    canCopy,
    canCut,
    canPaste,
    canDelete,
    canDuplicate,
    canExportSelection,
    canGroup,
    canUngroup,
    canCreateComponent,
    canCreateComponentSet,
    canDetachInstance,
    canWrapInAutoLayout,
    canBringToFront,
    canSendToBack,
    canToggleVisibility,
    canToggleLock,
    canGoToMainComponent,
    canCreateInstance,
    canMoveToPage,
    canSelectAll,
    canUndo,
    canRedo,
    canZoomToSelection
  }
}
