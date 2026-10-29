import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { hasPluginData, OPEN_PENCIL_PLUGIN_DATA } from '@open-pencil/scene-graph/plugin-data'

let editor: Editor

afterEach(() => editor.dispose())

const rootPluginData = () => editor.graph.getNode(editor.graph.rootId)?.pluginData

describe('file compression in the editor', () => {
  test('changes the document compression as one undo step', () => {
    editor = createEditor()
    expect(editor.figCompression()).toBe('fast')
    editor.setFigCompression('smallest')
    expect(editor.figCompression()).toBe('smallest')
    editor.undo.undo()
    expect(editor.figCompression()).toBe('fast')
    editor.undo.redo()
    expect(editor.figCompression()).toBe('smallest')
  })

  test('the default leaves no entry on the document', () => {
    editor = createEditor()
    editor.setFigCompression('smaller')
    expect(hasPluginData(rootPluginData(), OPEN_PENCIL_PLUGIN_DATA.figCompression)).toBe(true)
    editor.setFigCompression('fast')
    expect(hasPluginData(rootPluginData(), OPEN_PENCIL_PLUGIN_DATA.figCompression)).toBe(false)
  })
})
