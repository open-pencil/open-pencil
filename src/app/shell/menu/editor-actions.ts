import type { SceneNode } from '@open-pencil/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'
import { setSnappingPreference } from '@/app/settings/preferences/apply'

type TextFormatUpdates = {
  fontWeight?: number
  italic?: boolean
  textDecoration?: 'NONE' | 'UNDERLINE'
}

const store = useEditorStore()

export function alignSelected(
  axis: 'horizontal' | 'vertical',
  align: 'min' | 'center' | 'max'
): void {
  store.alignNodes([...store.state.selectedIds], axis, align)
}

export function updateSelectedText(updates: TextFormatUpdates): void {
  for (const node of store.selectedNodes.value) {
    if (node.type === 'TEXT') store.updateNodeWithUndo(node.id, updates, 'Format text')
  }
}

export function selectedTextNode(): SceneNode | undefined {
  return store.selectedNodes.value.find((item) => item.type === 'TEXT')
}

export function toggleSelectedTextBold(): void {
  const node = selectedTextNode()
  updateSelectedText({
    fontWeight: node && node.fontWeight >= 700 ? 400 : 700
  })
}

export function toggleSelectedTextItalic(): void {
  const node = selectedTextNode()
  updateSelectedText({ italic: node ? !node.italic : true })
}

export function toggleSelectedTextUnderline(): void {
  const node = selectedTextNode()
  updateSelectedText({
    textDecoration: node?.textDecoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE'
  })
}

export function createSharedEditorMenuActions(
  setTheme: (theme: 'light' | 'dark' | 'auto') => void
) {
  return {
    'zoom-in': () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2),
    'zoom-out': () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2),
    'view-split-right': () => store.splitPane(store.activePaneId.value, 'horizontal'),
    'view-split-down': () => store.splitPane(store.activePaneId.value, 'vertical'),
    'view-rulers': () => {
      store.state.showRulers = !store.state.showRulers
      store.requestRepaint()
    },
    'view-multiplayer-cursors': () => {
      store.state.showRemoteCursors = !store.state.showRemoteCursors
      store.requestRepaint()
    },
    'snap-geometry': () =>
      setSnappingPreference('geometry', !store.state.snappingPreferences.geometry),
    'snap-objects': () =>
      setSnappingPreference('objects', !store.state.snappingPreferences.objects),
    'snap-pixel-grid': () =>
      setSnappingPreference('pixelGrid', !store.state.snappingPreferences.pixelGrid),
    'toggle-ui': () => {
      store.state.showUI = !store.state.showUI
    },
    'theme-light': () => setTheme('light'),
    'theme-dark': () => setTheme('dark'),
    'theme-auto': () => setTheme('auto'),
    'text.bold': toggleSelectedTextBold,
    'text.italic': toggleSelectedTextItalic,
    'text.underline': toggleSelectedTextUnderline,
    'arrange.align-left': () => alignSelected('horizontal', 'min'),
    'arrange.align-center': () => alignSelected('horizontal', 'center'),
    'arrange.align-right': () => alignSelected('horizontal', 'max'),
    'arrange.align-top': () => alignSelected('vertical', 'min'),
    'arrange.align-middle': () => alignSelected('vertical', 'center'),
    'arrange.align-bottom': () => alignSelected('vertical', 'max')
  }
}
