import type { SceneNode } from '@open-pencil/core/scene-graph'

import { useEditorStore } from '@/app/editor/active-store'

type TextFormatUpdates = {
  fontWeight?: number
  italic?: boolean
  textDecoration?: 'NONE' | 'UNDERLINE'
}

const store = useEditorStore()

export function alignSelected(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max'): void {
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
  updateSelectedText({ fontWeight: node && node.fontWeight >= 700 ? 400 : 700 })
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

export function createSharedEditorMenuActions(setTheme: (theme: 'light' | 'dark' | 'auto') => void) {
  return {
    'zoom-in': () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2),
    'zoom-out': () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2),
    'toggle-ui': () => {
      store.state.showUI = !store.state.showUI
    },
    'theme-light': () => setTheme('light'),
    'theme-dark': () => setTheme('dark'),
    'theme-auto': () => setTheme('auto'),
    'text.bold': toggleSelectedTextBold,
    'text.italic': toggleSelectedTextItalic,
    'text.underline': toggleSelectedTextUnderline,
    'align-left': () => alignSelected('horizontal', 'min'),
    'align-center': () => alignSelected('horizontal', 'center'),
    'align-right': () => alignSelected('horizontal', 'max'),
    'align-top': () => alignSelected('vertical', 'min'),
    'align-middle': () => alignSelected('vertical', 'center'),
    'align-bottom': () => alignSelected('vertical', 'max')
  }
}
