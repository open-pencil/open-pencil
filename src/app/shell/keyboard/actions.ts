import type { Ref } from 'vue'

import { opacityFromBuffer } from '@open-pencil/core/editor'
import type { useEditorCommands, useViewportKind } from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'

type KeyboardActionsOptions = {
  store: EditorStore
  activeTab: Ref<'design' | 'code' | 'ai'>
  isMobile: ReturnType<typeof useViewportKind>['isMobile']
  runCommand: ReturnType<typeof useEditorCommands>['runCommand']
  setOpacityTarget: ReturnType<typeof useEditorCommands>['setOpacityTarget']
}

export function createKeyboardActions({
  store,
  activeTab,
  isMobile,
  runCommand,
  setOpacityTarget
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

  let opacityBuffer = ''
  let opacitySelectionKey = ''
  let opacityCoalesceKey = ''
  let opacityResetTimer: ReturnType<typeof setTimeout> | undefined

  function resetOpacityBuffer() {
    opacityBuffer = ''
    opacitySelectionKey = ''
    opacityCoalesceKey = ''
    clearTimeout(opacityResetTimer)
  }

  function opacityDigit(digit: string) {
    if (store.state.selectedIds.size === 0) return
    const selectionKey = [...store.state.selectedIds].sort().join('\0')
    if (selectionKey !== opacitySelectionKey) resetOpacityBuffer()
    if (!opacityBuffer) {
      opacitySelectionKey = selectionKey
      opacityCoalesceKey = crypto.randomUUID()
    }
    opacityBuffer += digit
    if (opacityBuffer.length > 3) opacityBuffer = opacityBuffer.slice(-3)
    setOpacityTarget(opacityFromBuffer(opacityBuffer), opacityCoalesceKey)
    runCommand('selection.setOpacity')
    clearTimeout(opacityResetTimer)
    opacityResetTimer = setTimeout(resetOpacityBuffer, 800)
  }

  return {
    smartDelete,
    confirmOrEnterText,
    escapeOrDeselect,
    toggleAutoLayout,
    toggleUI,
    toggleAI,
    exportSelectionPng,
    opacityDigit
  }
}
