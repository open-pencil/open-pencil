import { describe, expect, test } from 'bun:test'

import {
  copyEditorViewState,
  createDefaultEditorState,
  EDITOR_SHARED_STATE_KEYS,
  EDITOR_VIEW_STATE_KEYS,
  pickEditorViewState
} from '@open-pencil/core/editor'

describe('editor state ownership', () => {
  test('classifies every editor state field as shared or view-local', () => {
    const state = createDefaultEditorState('page')
    const keys = [...EDITOR_SHARED_STATE_KEYS, ...EDITOR_VIEW_STATE_KEYS]

    expect(new Set(keys).size).toBe(keys.length)
    for (const key of Object.keys(state)) expect(keys).toContain(key as keyof typeof state)
  })

  test('copies mutable view state for an independent canvas surface', () => {
    const state = createDefaultEditorState('page')
    state.selectedIds = new Set(['selected'])
    state.snapGuides = [{ axis: 'x', position: 10, from: 0, to: 20 }]
    const source = pickEditorViewState(state)
    const copy = copyEditorViewState(source)

    copy.selectedIds.add('pane-only')
    copy.snapGuides.length = 0
    copy.pageColor.r = 0.5

    expect(source.selectedIds).toEqual(new Set(['selected']))
    expect(source.snapGuides).toHaveLength(1)
    expect(source.pageColor.r).not.toBe(0.5)
  })
})
