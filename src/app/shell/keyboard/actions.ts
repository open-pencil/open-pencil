import type { Ref } from 'vue'

import { opacityFromBuffer } from '@open-pencil/core'
import { generatedFrameText } from '@open-pencil/scene-graph/generated'
import type { useEditorCommands } from '@open-pencil/vue/editor/commands'
import type { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'

import type { PropertiesTab } from '@/app/ai/chat/use'
import { useComments } from '@/app/comments/use'
import type { EditorStore } from '@/app/editor/active-store'

type KeyboardActionsOptions = {
  store: EditorStore
  activeTab: Ref<PropertiesTab>
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
        store.state.nodeEditState.selectedSegmentIndices.size > 0 ||
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

  function confirmOrEditSelection() {
    if (store.state.nodeEditState) {
      store.exitNodeEditMode(true)
      return
    }
    if (store.state.penState) {
      store.penCommit(false)
      return
    }
    const node = store.selectedNode.value
    // Figma opens a selected vector's path, as a double-click does.
    if (node?.type === 'VECTOR') {
      store.enterNodeEditMode(node.id)
      return
    }
    // A sticky note opens its body and a connector its label, all of it selected, keeping the
    // note or connector selected.
    const text = (node && generatedFrameText(store.graph, node)) ?? node
    if (text?.type === 'TEXT') {
      requestAnimationFrame(() => {
        store.startTextEditing(text.id)
        store.textEditor?.selectAll()
        store.requestRender()
      })
      return
    }
    runCommand('selection.selectChildren')
  }

  function escapeOrDeselect() {
    if (store.state.play) {
      store.stopPlay()
      return
    }
    if (store.state.rotationPreview) {
      store.setRotationPreview(null)
      return
    }
    if (store.state.nodeEditState) {
      store.exitNodeEditMode(true)
      return
    }
    if (store.state.pencilState) {
      store.pencilCancel()
      return
    }
    // Figma keeps the path drawn so far; a lone point has nothing to keep.
    if (store.state.penState) {
      if (store.state.penState.vertices.length >= 2) store.penCommit(false)
      else store.penCancel()
      return
    }
    if (store.state.enteredContainerId) {
      store.exitContainer()
      return
    }
    if (useComments().closeCard()) return
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

  function togglePlay() {
    store.togglePlay()
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

  function exportSelectionPNG() {
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
    confirmOrEditSelection,
    escapeOrDeselect,
    toggleAutoLayout,
    toggleUI,
    togglePlay,
    toggleAI,
    exportSelectionPNG,
    opacityDigit
  }
}
