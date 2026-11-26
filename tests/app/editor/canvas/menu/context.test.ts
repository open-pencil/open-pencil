import { describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core'
import type { EditorCommandId } from '@open-pencil/vue/editor/commands'
import type { MenuEntry } from '@open-pencil/vue/editor/menu-model'

import {
  buildCanvasMenu,
  type CanvasMenuLabels,
  type CanvasMenuSources,
  type CanvasMenuState
} from '@/app/editor/canvas/menu/context'

const labels = new Proxy({} as CanvasMenuLabels, { get: (_, key) => String(key) })

const noop = () => undefined
const actions = new Proxy({} as CanvasMenuSources['actions'], { get: () => noop })

const sources: CanvasMenuSources = {
  editor: {} as Editor,
  actions,
  commandMenuItem: (id: EditorCommandId) => ({ id, label: id, action: noop }),
  layerEntries: [
    { id: 'selection.duplicate', label: 'duplicate' },
    { id: 'selection.delete', label: 'delete' },
    { separator: true },
    { id: 'selection.group', label: 'group' }
  ],
  labels
}

const state: CanvasMenuState = {
  commenting: false,
  guideSelected: false,
  hasSelection: true,
  canVectorizeImage: false
}

/** What a menu shows, top to bottom: labels, `—` for a separator, `name>` for a submenu. */
function outline(entries: readonly MenuEntry[]): string[] {
  return entries.map((entry) => {
    if (entry.separator) return '—'
    return entry.sub ? `${entry.label}>` : entry.label
  })
}

describe('buildCanvasMenu', () => {
  test('a layer gets the clipboard, its commands, and Copy/Paste as', () => {
    expect(outline(buildCanvasMenu({ ...state, target: 'layer' }, sources))).toEqual([
      'copy',
      'cut',
      'pasteHere',
      'pasteToReplace',
      'pasteAsLayers',
      'duplicate',
      'delete',
      '—',
      'group',
      '—',
      'copyPasteAs>'
    ])
  })

  test('without a selection the clipboard needs one and Copy/Paste as is left out', () => {
    const entries = buildCanvasMenu({ ...state, hasSelection: false, target: 'canvas' }, sources)
    expect(outline(entries).at(-1)).toBe('group')
    const disabled = entries.filter((entry) => !entry.separator && entry.disabled)
    expect(disabled.map((entry) => !entry.separator && entry.label)).toEqual([
      'copy',
      'cut',
      'pasteToReplace'
    ])
  })

  test('an image offers Convert to vector', () => {
    const entries = buildCanvasMenu({ ...state, canVectorizeImage: true, target: 'layer' }, sources)
    expect(outline(entries).slice(-4)).toEqual(['—', 'convertToVector', '—', 'copyPasteAs>'])
  })

  test('a selected guide offers only its removal', () => {
    expect(outline(buildCanvasMenu({ ...state, guideSelected: true }, sources))).toEqual([
      'removeGuide'
    ])
  })

  // In Figma, the Comment tool's right-click opens a short menu.
  test('the Comment tool keeps its menu short', () => {
    const commenting = { ...state, commenting: true, guideSelected: true }
    expect(outline(buildCanvasMenu({ ...commenting, target: 'layer' }, sources))).toEqual([
      'selection.toggleVisibility',
      'selection.toggleLock',
      '—',
      'toggleUI',
      'hideComments'
    ])
    expect(outline(buildCanvasMenu({ ...commenting, target: 'canvas' }, sources))).toEqual([
      'toggleUI',
      'hideComments'
    ])
    expect(outline(buildCanvasMenu({ ...commenting, target: 'guide' }, sources))).toEqual([
      'removeGuide'
    ])
    // The layers panel has no target and keeps the full layer menu.
    expect(outline(buildCanvasMenu({ ...state, commenting: true }, sources))[0]).toBe('copy')
  })
})
