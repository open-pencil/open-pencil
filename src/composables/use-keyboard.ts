import { useEventListener } from '@vueuse/core'

import { useAIChat } from '@/composables/use-chat'
import { TOOL_SHORTCUTS, useEditorStore } from '@/stores/editor'
import { closeTab, createTab, activeTab as activeTabRef } from '@/stores/tabs'

import { openFileDialog } from './use-menu'

function isEditing(e: Event) {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
}

export function useKeyboard() {
  const { activeTab } = useAIChat()

  function store() {
    return useEditorStore()
  }

  useEventListener(window, 'copy', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) store().writeCopyData(e.clipboardData)
  })

  useEventListener(window, 'cut', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) store().writeCopyData(e.clipboardData)
    store().deleteSelected()
  })

  useEventListener(window, 'paste', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    const html = e.clipboardData?.getData('text/html') ?? ''
    if (html) store().pasteFromHTML(html)
  })

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e)) return
    const s = store()

    const tool = TOOL_SHORTCUTS[e.key.toLowerCase()]
    if (tool) {
      s.setTool(tool)
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.altKey) {
      if (e.code === 'KeyK') {
        e.preventDefault()
        s.createComponentFromSelection()
        return
      }
      if (e.code === 'KeyB') {
        e.preventDefault()
        s.detachInstance()
        return
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      if (e.code === 'KeyK') {
        e.preventDefault()
        s.createComponentSetFromComponents()
        return
      }
      if (e.code === 'KeyH') {
        e.preventDefault()
        s.toggleVisibility()
        return
      }
      if (e.code === 'KeyL') {
        e.preventDefault()
        s.toggleLock()
        return
      }
      if (e.code === 'KeyE') {
        e.preventDefault()
        if (s.state.selectedIds.size > 0) {
          s.exportSelection(1, 'PNG')
        }
        return
      }
    }

    if (e.metaKey || e.ctrlKey) {
      if (e.code === 'Backslash') {
        e.preventDefault()
        s.state.showUI = !s.state.showUI
        return
      }
      if (e.code === 'KeyJ') {
        e.preventDefault()
        activeTab.value = activeTab.value === 'ai' ? 'design' : 'ai'
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
        s.undoAction()
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        s.redoAction()
      } else if (e.key === '0') {
        e.preventDefault()
        s.zoomToFit()
      } else if (e.key === 'd') {
        e.preventDefault()
        s.duplicateSelected()
      } else if (e.key === 'a') {
        e.preventDefault()
        s.selectAll()
      } else if (e.key === 's' && e.shiftKey) {
        e.preventDefault()
        s.saveFigFileAs()
      } else if (e.key === 's') {
        e.preventDefault()
        s.saveFigFile()
      } else if (e.key === 'o') {
        e.preventDefault()
        openFileDialog()
      } else if (e.key === 'g' && !e.shiftKey) {
        e.preventDefault()
        s.groupSelected()
      } else if (e.key === 'g' && e.shiftKey) {
        e.preventDefault()
        s.ungroupSelected()
      }
    }

    if (e.shiftKey && e.key === 'A') {
      e.preventDefault()
      const node = s.selectedNode.value
      if (node && node.type === 'FRAME' && s.selectedNodes.value.length === 1) {
        s.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
      } else if (s.selectedNodes.value.length > 0) {
        s.wrapInAutoLayout()
      }
      return
    }

    if (e.key === ']') {
      e.preventDefault()
      s.bringToFront()
      return
    }
    if (e.key === '[') {
      e.preventDefault()
      s.sendToBack()
      return
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      s.deleteSelected()
    }

    if (e.key === 'Enter' && s.state.penState) {
      e.preventDefault()
      s.penCommit(false)
      return
    }

    if (e.key === 'Escape') {
      if (s.state.penState) {
        s.penCancel()
        return
      }
      s.clearSelection()
      s.setTool('SELECT')
    }
  })
}
