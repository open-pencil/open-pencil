import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

let editor: Editor

afterEach(() => editor.dispose())

const binding = { libraryId: 'lib-1', revisionId: 'rev-1', enabled: true }

describe('document settings in the editor', () => {
  test('announces a change to the libraries, and nothing when they stay the same', () => {
    editor = createEditor()
    let announced = 0
    editor.onEditorEvent('document:libraries-changed', () => announced++)
    editor.updateEnabledLibraries((bindings) => bindings.set('lib-1', binding))
    editor.updateEnabledLibraries((bindings) => bindings.set('lib-1', { ...binding }))
    expect(announced).toBe(1)
    expect(editor.graph.enabledLibraries.get('lib-1')).toEqual(binding)
  })

  test('a read-only document still takes settings written from elsewhere', () => {
    editor = createEditor()
    editor.setReadOnly(true)
    const colorSpaces: string[] = []
    editor.onEditorEvent('document:color-space-changed', (colorSpace) => colorSpaces.push(colorSpace))
    editor.graph.documentColorSpace = 'display-p3'
    editor.refreshDocumentSettings()
    expect(colorSpaces).toEqual(['display-p3'])
  })
})
