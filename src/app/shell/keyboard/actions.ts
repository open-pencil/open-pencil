import type { Ref } from 'vue'

import type { useEditorCommands, useViewportKind } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'

type KeyboardActionsOptions = {
  store: EditorStore
  activeTab: Ref<'design' | 'code' | 'ai'>
  isMobile: ReturnType<typeof useViewportKind>['isMobile']
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
}

export function createKeyboardActions({
  store,
  activeTab,
  isMobile,
  runCommand
}: KeyboardActionsOptions) {
  function hasNodeEditSelection() {
    return (
      store.state.nodeEditState &&
      (store.state.nodeEditState.selectedVertexIndices.size > 0 ||
        store.state.nodeEditState.selectedHandles.size > 0)
    )
  }

  function smartDelete(altKey: boolean) {
    if (hasNodeEditSelection()) {
      if (altKey) store.nodeEditBreakAtVertex()
      else store.nodeEditDeleteSelected()
      return
    }
    runCommand('selection.delete')
  }

  function confirmOrEnterText() {
    if (store.state.nodeEditState) {
      store.exitNodeEditMode(true)
      return
    }
    if (store.state.penState) {
      store.penCommit(false)
      return
    }
    const node = store.selectedNode.value
    if (node?.type === 'TEXT') {
      requestAnimationFrame(() => {
        store.startTextEditing(node.id)
        store.textEditor?.selectAll()
        store.requestRender()
      })
    }
  }

  function escapeOrDeselect() {
    if (store.state.nodeEditState) {
      store.exitNodeEditMode(true)
      return
    }
    if (store.state.penState) {
      store.penCancel()
      return
    }
    if (store.state.enteredContainerId) {
      store.exitContainer()
      return
    }
    store.clearSelection()
    store.setTool('SELECT')
  }

  function toggleAutoLayout() {
    const node = store.selectedNode.value
    if (node?.type === 'FRAME' && store.selectedNodes.value.length === 1) {
      store.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
    } else if (store.selectedNodes.value.length > 0) {
      runCommand('selection.wrapInAutoLayout')
    }
  }

  function toggleUI() {
    store.state.showUI = !store.state.showUI
  }

  function toggleAI() {
    if (isMobile.value) {
      store.state.activeRibbonTab = store.state.activeRibbonTab === 'ai' ? 'panels' : 'ai'
      if (store.state.mobileDrawerSnap === 'closed') {
        store.state.mobileDrawerSnap = 'half'
      }
    } else {
      activeTab.value = activeTab.value === 'ai' ? 'design' : 'ai'
    }
  }

  function exportSelectionPng() {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
  }

  return {
    smartDelete,
    confirmOrEnterText,
    escapeOrDeselect,
    toggleAutoLayout,
    toggleUI,
    toggleAI,
    exportSelectionPng
  }
}
