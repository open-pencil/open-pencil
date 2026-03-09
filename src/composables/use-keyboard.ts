import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useBreakpoints, useEventListener, useMagicKeys, whenever } from '@vueuse/core'

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

  const keys = useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (isEditing(e)) return

      // Space held → temporary pan tool
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.type === 'keydown' && store.state.activeTool !== 'HAND') {
          e.preventDefault()
          store.state.spaceToolPrev = store.state.activeTool
          store.setTool('HAND')
        } else if (e.type === 'keyup' && store.state.spaceToolPrev) {
          store.setTool(store.state.spaceToolPrev)
          store.state.spaceToolPrev = null
        }
        return
      }

      if (e.type !== 'keydown') return

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()]
        if (tool) {
          store.setTool(tool)
          return
        }
      }

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.altKey && ['KeyK', 'KeyB'].includes(e.code)) e.preventDefault()
      if (mod && e.shiftKey && ['KeyK', 'KeyH', 'KeyL', 'KeyE', 'KeyS', 'KeyG', 'KeyZ'].includes(e.code))
        e.preventDefault()
      if (mod && !e.shiftKey && !e.altKey) {
        if (
          [
            'Backslash', 'KeyJ', 'KeyW', 'KeyN', 'KeyT', 'KeyZ', 'KeyY',
            'Digit0', 'Digit1', 'Digit2',
            'KeyD', 'KeyA', 'KeyS', 'KeyO', 'KeyG'
          ].includes(e.code)
        ) e.preventDefault()
      }
      if (!mod && e.shiftKey && ['Digit1', 'Digit2', 'KeyA'].includes(e.code)) e.preventDefault()
      if (!mod && !e.shiftKey && ['[', ']'].includes(e.key)) e.preventDefault()
      if (['Backspace', 'Delete'].includes(e.key)) e.preventDefault()
      if (e.key === 'Enter' && store.state.penState) e.preventDefault()
    }
  })

  // Cross-platform mod: true when Meta (Mac) or Control (Win/Linux) is pressed with the combo.
  // Checks that no extra modifiers are held beyond what the combo specifies.
  function mod(combo: string): ComputedRef<boolean> {
    const hasShift = combo.includes('shift')
    const hasAlt = combo.includes('alt')
    const base = computed(() => keys[`meta+${combo}`].value || keys[`control+${combo}`].value)
    if (hasShift && hasAlt) return base
    if (hasShift) return computed(() => base.value && !keys['alt'].value)
    if (hasAlt) return computed(() => base.value && !keys['shift'].value)
    return computed(() => base.value && !keys['shift'].value && !keys['alt'].value)
  }

  // --- Mod + Alt ---
  whenever(mod('alt+keyk'), () => store.createComponentFromSelection())
  whenever(mod('alt+keyb'), () => store.detachInstance())

  // --- Mod + Shift ---
  whenever(mod('shift+keyk'), () => store.createComponentSetFromComponents())
  whenever(mod('shift+keyh'), () => store.toggleVisibility())
  whenever(mod('shift+keyl'), () => store.toggleLock())
  whenever(mod('shift+keye'), () => {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'PNG')
  })
  whenever(mod('shift+keys'), () => store.saveFigFileAs())
  whenever(mod('shift+keyg'), () => store.ungroupSelected())
  whenever(mod('shift+keyz'), () => store.redoAction())

  // --- Mod + Key ---
  whenever(mod('backslash'), () => { store.state.showUI = !store.state.showUI })
  whenever(mod('keyj'), () => {
    if (isMobile.value) {
      store.state.activeRibbonTab = store.state.activeRibbonTab === 'ai' ? 'panels' : 'ai'
      if (store.state.mobileDrawerSnap === 'closed') {
        store.state.mobileDrawerSnap = 'half'
      }
    } else {
      activeTab.value = activeTab.value === 'ai' ? 'design' : 'ai'
    }
  })
  whenever(mod('keyw'), () => { if (activeTabRef.value) closeTab(activeTabRef.value.id) })
  whenever(mod('keyn'), () => createTab())
  whenever(mod('keyt'), () => createTab())
  whenever(mod('keyz'), () => store.undoAction())
  whenever(mod('keyy'), () => store.redoAction())
  whenever(mod('digit0'), () => store.zoomTo100())
  whenever(mod('digit1'), () => store.zoomToFit())
  whenever(mod('digit2'), () => store.zoomToSelection())
  whenever(mod('keyd'), () => store.duplicateSelected())
  whenever(mod('keya'), () => store.selectAll())
  whenever(mod('keys'), () => store.saveFigFile())
  whenever(mod('keyo'), () => openFileDialog())
  whenever(mod('keyg'), () => store.groupSelected())

  // --- Shift (no mod) ---
  whenever(
    computed(() => keys['shift+digit1'].value && !keys['meta'].value && !keys['control'].value),
    () => store.zoomToFit()
  )
  whenever(
    computed(() => keys['shift+digit2'].value && !keys['meta'].value && !keys['control'].value),
    () => store.zoomToSelection()
  )
  whenever(
    computed(() => keys['shift+keya'].value && !keys['meta'].value && !keys['control'].value),
    () => {
      const node = store.selectedNode.value
      if (node?.type === 'FRAME' && store.selectedNodes.value.length === 1) {
        store.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
      } else if (store.selectedNodes.value.length > 0) {
        store.wrapInAutoLayout()
      }
    }
  )

  // --- Plain keys (no modifiers) ---
  function plain(key: string): ComputedRef<boolean> {
    return computed(
      () => keys[key].value && !keys['meta'].value && !keys['control'].value
        && !keys['shift'].value && !keys['alt'].value
    )
  }

  whenever(plain('bracketright'), () => store.bringToFront())
  whenever(plain('bracketleft'), () => store.sendToBack())
  whenever(plain('backspace'), () => store.deleteSelected())
  whenever(plain('delete'), () => store.deleteSelected())
  whenever(plain('enter'), () => {
    if (store.state.penState) store.penCommit(false)
  })
  whenever(plain('escape'), () => {
    if (store.state.penState) {
      store.penCancel()
      return
    }
    store.clearSelection()
    store.setTool('SELECT')
  })
}
