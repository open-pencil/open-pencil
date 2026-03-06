import { useBreakpoints, useEventListener } from '@vueuse/core'

import { useAIChat } from '@/composables/use-chat'
import { TOOL_SHORTCUTS, useEditorStore } from '@/stores/editor'
import { closeTab, createTab, activeTab as activeTabRef } from '@/stores/tabs'

import { openFileDialog } from './use-menu'

function isEditing(e: Event) {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
}

export function useKeyboard() {
  const { activeTab } = useAIChat()
  const store = useEditorStore()
  const breakpoints = useBreakpoints({ mobile: 768 })
  const isMobile = breakpoints.smaller('mobile')

  useEventListener(window, 'copy', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) store.writeCopyData(e.clipboardData)
  })

  useEventListener(window, 'cut', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) store.writeCopyData(e.clipboardData)
    store.deleteSelected()
  })

  useEventListener(window, 'paste', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    const html = e.clipboardData?.getData('text/html') ?? ''
    if (html) store.pasteFromHTML(html)
  })

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e)) return

    const tool = TOOL_SHORTCUTS[e.key.toLowerCase()]
    if (tool) {
      store.setTool(tool)
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.altKey) {
      if (e.code === 'KeyK') {
        e.preventDefault()
        store.createComponentFromSelection()
        return
      }
      if (e.code === 'KeyB') {
        e.preventDefault()
        store.detachInstance()
        return
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      if (e.code === 'KeyK') {
        e.preventDefault()
        store.createComponentSetFromComponents()
        return
      }
      if (e.code === 'KeyH') {
        e.preventDefault()
        store.toggleVisibility()
        return
      }
      if (e.code === 'KeyL') {
        e.preventDefault()
        store.toggleLock()
        return
      }
      if (e.code === 'KeyE') {
        e.preventDefault()
        if (store.state.selectedIds.size > 0) {
          store.exportSelection(1, 'PNG')
        }
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      if (e.code === 'Backslash') {
        e.preventDefault()
        store.state.showUI = !store.state.showUI
        return
      }
      if (e.code === 'KeyJ') {
        e.preventDefault()
        if (isMobile.value) {
          store.state.activeRibbonTab = store.state.activeRibbonTab === 'ai' ? 'panels' : 'ai'
          if (store.state.mobileDrawerSnap === 'closed') {
            store.state.mobileDrawerSnap = 'half'
          }
        } else {
          activeTab.value = activeTab.value === 'ai' ? 'design' : 'ai'
        }
        return
      }
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabRef.value) closeTab(activeTabRef.value.id)
        return
      }
      if (e.key === 'n' || e.key === 't') {
        e.preventDefault()
        createTab()
        return
      }
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undoAction()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        store.redoAction()
      } else if (e.key === '0') {
        e.preventDefault()
        store.zoomToFit()
      } else if (e.key === 'd') {
        e.preventDefault()
        store.duplicateSelected()
      } else if (e.key === 'a') {
        e.preventDefault()
        store.selectAll()
      } else if (e.key === 's' && e.shiftKey) {
        e.preventDefault()
        store.saveFigFileAs()
      } else if (e.key === 's') {
        e.preventDefault()
        store.saveFigFile()
      } else if (e.key === 'o') {
        e.preventDefault()
        openFileDialog()
      } else if (e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        store.groupSelected()
      } else if (e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        store.ungroupSelected()
      }
    }

    if (e.shiftKey && e.key === 'A') {
      e.preventDefault()
      const node = store.selectedNode.value
      if (node && node.type === 'FRAME' && store.selectedNodes.value.length === 1) {
        store.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
      } else if (store.selectedNodes.value.length > 0) {
        store.wrapInAutoLayout()
      }
      return
    }

    if (e.key === ']') {
      e.preventDefault()
      store.bringToFront()
      return
    }
    if (e.key === '[') {
      e.preventDefault()
      store.sendToBack()
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      store.deleteSelected()
    }

    if (e.key === 'Enter' && store.state.penState) {
      e.preventDefault()
      store.penCommit(false)
      return
    }

    if (e.key === 'Escape') {
      if (store.state.penState) {
        store.penCancel()
        return
      }
      store.clearSelection()
      store.setTool('SELECT')
    }
  })
}
