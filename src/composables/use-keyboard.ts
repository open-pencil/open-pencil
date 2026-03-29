import { useEventListener, useMagicKeys, whenever } from '@vueuse/core'
import { computed } from 'vue'

import { useAIChat } from '@/composables/use-chat'
import { TOOL_SHORTCUTS, useEditorStore } from '@/stores/editor'
import { closeTab, createTab, activeTab as activeTabRef } from '@/stores/tabs'
import {
  extractImageFilesFromClipboard,
  useEditorCommands,
  useViewportKind
} from '@open-pencil/vue'

import { openFileDialog } from './use-menu'

import type { ComputedRef } from 'vue'

function isEditing(e: Event) {
  return e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
}

const PREVENT_MOD_ALT = new Set(['KeyK', 'KeyB'])
const PREVENT_MOD_SHIFT = new Set(['KeyK', 'KeyH', 'KeyL', 'KeyE', 'KeyS', 'KeyG', 'KeyZ'])
const PREVENT_MOD_ONLY = new Set([
  'Backslash',
  'KeyJ',
  'KeyW',
  'KeyN',
  'KeyT',
  'KeyZ',
  'KeyY',
  'Digit0',
  'Digit1',
  'Digit2',
  'KeyD',
  'KeyA',
  'KeyS',
  'KeyO',
  'KeyG'
])
const PREVENT_SHIFT_ONLY = new Set(['Digit1', 'Digit2', 'KeyA'])
const PREVENT_PLAIN_KEY = new Set(['BracketLeft', 'BracketRight'])
const PREVENT_DELETE_KEY = new Set(['Backspace', 'Delete'])

function shouldPreventDefault(e: KeyboardEvent, hasPenState: boolean): boolean {
  const mod = e.metaKey || e.ctrlKey

  if (mod) {
    if (e.altKey && PREVENT_MOD_ALT.has(e.code)) return true
    if (e.shiftKey && PREVENT_MOD_SHIFT.has(e.code)) return true
    if (!e.shiftKey && !e.altKey && PREVENT_MOD_ONLY.has(e.code)) return true
  } else {
    if (e.shiftKey && PREVENT_SHIFT_ONLY.has(e.code)) return true
    if (!e.shiftKey && PREVENT_PLAIN_KEY.has(e.code)) return true
  }

  return PREVENT_DELETE_KEY.has(e.code) || (e.code === 'Enter' && hasPenState)
}

export function useKeyboard() {
  const { activeTab } = useAIChat()
  const store = useEditorStore()
  const { isMobile } = useViewportKind()
  const { runCommand } = useEditorCommands()

  useEventListener(window, 'copy', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) void store.writeCopyData(e.clipboardData)
  })

  useEventListener(window, 'cut', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()
    if (e.clipboardData) void store.writeCopyData(e.clipboardData)
    store.deleteSelected()
  })

  useEventListener(window, 'paste', (e: ClipboardEvent) => {
    if (isEditing(e)) return
    e.preventDefault()

    const { cursorCanvasX: ccx, cursorCanvasY: ccy } = store.state
    const cursorPos = ccx != null && ccy != null ? { x: ccx, y: ccy } : undefined

    const imageFiles = extractImageFilesFromClipboard(e)
    if (imageFiles.length) {
      const cx = cursorPos?.x ?? (-store.state.panX + window.innerWidth / 2) / store.state.zoom
      const cy = cursorPos?.y ?? (-store.state.panY + window.innerHeight / 2) / store.state.zoom
      void store.placeImageFiles(imageFiles, cx, cy)
      return
    }

    const html = e.clipboardData?.getData('text/html') ?? ''
    if (html) store.pasteFromHTML(html, cursorPos)
  })

  // Spacebar hold → temporary Hand tool (Figma-style canvas pan)
  let toolBeforeSpace: typeof store.state.activeTool | null = null

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e)) return
    if (
      e.code === 'Space' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.repeat &&
      toolBeforeSpace === null
    ) {
      if (store.state.activeTool !== 'HAND') {
        toolBeforeSpace = store.state.activeTool
        store.setTool('HAND')
      }
      e.preventDefault()
    }
  })

  useEventListener(window, 'keyup', (e: KeyboardEvent) => {
    if (e.code === 'Space' && toolBeforeSpace !== null) {
      store.setTool(toolBeforeSpace)
      toolBeforeSpace = null
      e.preventDefault()
    }
  })

  const keys = useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (e.type !== 'keydown') return
      if (isEditing(e)) return
      if (store.state.editingTextId) return

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        // Space is handled by hold-to-pan above
        if (e.code === 'Space') return
        const tool = TOOL_SHORTCUTS[e.code]
        if (tool) {
          // Permanent tool switch cancels space-hold
          toolBeforeSpace = null
          store.setTool(tool)
          return
        }
      }

      if (shouldPreventDefault(e, !!store.state.penState)) e.preventDefault()
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
  whenever(mod('alt+keyk'), () => runCommand('selection.createComponent'))
  whenever(mod('alt+keyb'), () => runCommand('selection.detachInstance'))

  // --- Mod + Shift ---
  whenever(mod('shift+keyk'), () => runCommand('selection.createComponentSet'))
  whenever(mod('shift+keyh'), () => runCommand('selection.toggleVisibility'))
  whenever(mod('shift+keyl'), () => runCommand('selection.toggleLock'))
  whenever(mod('shift+keye'), () => {
    if (store.state.selectedIds.size > 0) void store.exportSelection(1, 'png')
  })
  whenever(mod('shift+keys'), () => store.saveFigFileAs())
  whenever(mod('shift+keyg'), () => runCommand('selection.ungroup'))
  whenever(mod('shift+keyz'), () => runCommand('edit.redo'))

  // --- Mod + Key ---
  whenever(mod('backslash'), () => {
    store.state.showUI = !store.state.showUI
  })
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
  whenever(mod('keyw'), () => {
    if (activeTabRef.value) closeTab(activeTabRef.value.id)
  })
  whenever(mod('keyn'), () => createTab())
  whenever(mod('keyt'), () => createTab())
  whenever(mod('keyz'), () => runCommand('edit.undo'))
  whenever(mod('keyy'), () => runCommand('edit.redo'))
  whenever(mod('digit0'), () => runCommand('view.zoom100'))
  whenever(mod('digit1'), () => runCommand('view.zoomFit'))
  whenever(mod('digit2'), () => runCommand('view.zoomSelection'))
  whenever(mod('keyd'), () => runCommand('selection.duplicate'))
  whenever(mod('keya'), () => runCommand('selection.selectAll'))
  whenever(mod('keys'), () => store.saveFigFile())
  whenever(mod('keyo'), () => openFileDialog())
  whenever(mod('keyg'), () => runCommand('selection.group'))

  // --- Shift (no mod) ---
  whenever(
    computed(() => keys['shift+digit1'].value && !keys['meta'].value && !keys['control'].value),
    () => runCommand('view.zoomFit')
  )
  whenever(
    computed(() => keys['shift+digit2'].value && !keys['meta'].value && !keys['control'].value),
    () => runCommand('view.zoomSelection')
  )
  whenever(
    computed(() => keys['shift+keya'].value && !keys['meta'].value && !keys['control'].value),
    () => {
      const node = store.selectedNode.value
      if (node?.type === 'FRAME' && store.selectedNodes.value.length === 1) {
        store.setLayoutMode(node.id, node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE')
      } else if (store.selectedNodes.value.length > 0) {
        runCommand('selection.wrapInAutoLayout')
      }
    }
  )

  // --- Plain keys (no modifiers) ---
  function plain(key: string, options?: { allowAlt?: boolean }): ComputedRef<boolean> {
    const allowAlt = options?.allowAlt ?? false
    return computed(
      () =>
        keys[key].value &&
        !keys['meta'].value &&
        !keys['control'].value &&
        !keys['shift'].value &&
        (allowAlt || !keys['alt'].value) &&
        !store.state.editingTextId
    )
  }

  whenever(plain('BracketRight'), () => runCommand('selection.bringToFront'))
  whenever(plain('BracketLeft'), () => runCommand('selection.sendToBack'))
  whenever(plain('Backspace'), () => {
    if (
      store.state.nodeEditState &&
      (store.state.nodeEditState.selectedVertexIndices.size > 0 ||
        store.state.nodeEditState.selectedHandles.size > 0)
    ) {
      store.nodeEditDeleteSelected()
      return
    }
    runCommand('selection.delete')
  })
  whenever(plain('Delete', { allowAlt: true }), () => {
    if (
      store.state.nodeEditState &&
      (store.state.nodeEditState.selectedVertexIndices.size > 0 ||
        store.state.nodeEditState.selectedHandles.size > 0)
    ) {
      if (keys['alt'].value) {
        store.nodeEditBreakAtVertex()
      } else {
        store.nodeEditDeleteSelected()
      }
      return
    }
    runCommand('selection.delete')
  })
  whenever(plain('Enter'), () => {
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
  })
  whenever(plain('Escape'), () => {
    if (store.state.nodeEditState) {
      store.exitNodeEditMode(true)
      return
    }
    if (store.state.penState) {
      store.penCommit(false)
      return
    }
    if (store.state.enteredContainerId) {
      store.exitContainer()
      return
    }
    store.clearSelection()
    store.setTool('SELECT')
  })
}
