import { useEventListener, useMagicKeys, whenever } from '@vueuse/core'
import { computed, watch } from 'vue'

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

const NUDGE_DELTAS: Partial<Record<string, [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

export function useKeyboard() {
  const { activeTab } = useAIChat()
  const store = useEditorStore()
  const { isMobile } = useViewportKind()
  const { runCommand } = useEditorCommands()

  // ─── App-level actions ─────────────────────────────────────

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
      store.penCommit(false)
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

  // ─── Clipboard ──────────────────────────────────────────────

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

  // ─── Nudge (raw keydown for repeat events) ─────────────────

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (isEditing(e) || store.state.editingTextId) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const delta = NUDGE_DELTAS[e.code]
    if (delta && store.state.selectedIds.size > 0) {
      const step = e.shiftKey ? 10 : 1
      store.nudgeSelected(delta[0] * step, delta[1] * step)
      e.preventDefault()
    }
  })

  // ─── useMagicKeys ──────────────────────────────────────────

  const keys = useMagicKeys({
    passive: false,
    onEventFired(e) {
      if (e.type !== 'keydown') return
      if (isEditing(e) || store.state.editingTextId) return
      if (e.code === 'Backspace' || e.code === 'Delete') e.preventDefault()
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') e.preventDefault()
      if (e.code === 'Enter' && store.state.penState) e.preventDefault()
      if (e.code === 'Space') e.preventDefault()
    }
  })

  // ─── Helpers ───────────────────────────────────────────────

  function mod(combo: string): ComputedRef<boolean> {
    const hasShift = combo.includes('shift')
    const hasAlt = combo.includes('alt')
    const base = computed(() => keys[`meta+${combo}`].value || keys[`control+${combo}`].value)
    if (hasShift && hasAlt) return base
    if (hasShift) return computed(() => base.value && !keys['alt'].value)
    if (hasAlt) return computed(() => base.value && !keys['shift'].value)
    return computed(() => base.value && !keys['shift'].value && !keys['alt'].value)
  }

  function shift(key: string): ComputedRef<boolean> {
    return computed(
      () => keys[`shift+${key}`].value && !keys['meta'].value && !keys['control'].value
    )
  }

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

  // ─── Space hold → temporary Hand tool ──────────────────────

  let toolBeforeSpace: typeof store.state.activeTool | null = null

  const spaceHeld = computed(
    () => keys['Space'].value && !keys['meta'].value && !keys['control'].value && !keys['alt'].value
  )

  watch(spaceHeld, (held) => {
    if (held && toolBeforeSpace === null && store.state.activeTool !== 'HAND') {
      toolBeforeSpace = store.state.activeTool
      store.setTool('HAND')
    } else if (!held && toolBeforeSpace !== null) {
      store.setTool(toolBeforeSpace)
      toolBeforeSpace = null
    }
  })

  // ─── Tool shortcuts (plain single keys) ────────────────────

  for (const [code, tool] of Object.entries(TOOL_SHORTCUTS)) {
    if (!tool) continue
    whenever(plain(code), () => {
      toolBeforeSpace = null
      store.setTool(tool)
    })
  }

  // ─── Shortcut → action mapping ─────────────────────────────

  // Mod + Alt
  whenever(mod('alt+keyk'), () => runCommand('selection.createComponent'))
  whenever(mod('alt+keyb'), () => runCommand('selection.detachInstance'))

  // Mod + Shift
  whenever(mod('shift+keyk'), () => runCommand('selection.createComponentSet'))
  whenever(mod('shift+keyh'), () => runCommand('selection.toggleVisibility'))
  whenever(mod('shift+keyl'), () => runCommand('selection.toggleLock'))
  whenever(mod('shift+keye'), exportSelectionPng)
  whenever(mod('shift+keys'), () => store.saveFigFileAs())
  whenever(mod('shift+keyg'), () => runCommand('selection.ungroup'))
  whenever(mod('shift+keyz'), () => runCommand('edit.redo'))

  // Mod
  whenever(mod('backslash'), toggleUI)
  whenever(mod('keyj'), toggleAI)
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

  // Shift (no mod)
  whenever(shift('digit1'), () => runCommand('view.zoomFit'))
  whenever(shift('digit2'), () => runCommand('view.zoomSelection'))
  whenever(shift('keya'), toggleAutoLayout)

  // Plain keys
  whenever(plain('BracketRight'), () => runCommand('selection.bringToFront'))
  whenever(plain('BracketLeft'), () => runCommand('selection.sendToBack'))
  whenever(plain('Backspace'), () => smartDelete(false))
  whenever(plain('Delete', { allowAlt: true }), () => smartDelete(keys['alt'].value))
  whenever(plain('Enter'), confirmOrEnterText)
  whenever(plain('Escape'), escapeOrDeselect)
}
