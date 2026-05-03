import { describe, test, expect } from 'bun:test'

import { createEditorStore } from '../../src/app/editor/session'

describe('setPlannedFilePath', () => {
  test('sets document name from file path', () => {
    const store = createEditorStore()
    store.setPlannedFilePath('/tmp/projects/my-design.fig')
    expect(store.state.documentName).toBe('my-design')
  })

  test('handles Windows-style paths', () => {
    const store = createEditorStore()
    store.setPlannedFilePath('C:\\Users\\test\\design.fig')
    expect(store.state.documentName).toBe('design')
  })

  test('handles path without extension', () => {
    const store = createEditorStore()
    store.setPlannedFilePath('/tmp/Untitled')
    expect(store.state.documentName).toBe('Untitled')
  })
})
