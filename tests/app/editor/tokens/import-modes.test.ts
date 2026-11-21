import { describe, expect, test } from 'bun:test'

import { readDesignTokens } from '@open-pencil/core/io/formats/design-tokens'
import { SceneGraph } from '@open-pencil/scene-graph'

import { themeImportOptions } from '@/app/editor/tokens/import-modes'

const FILE = [{ path: 'brand.tokens.json', text: '{"bg":{"$type":"color","$value":"#ffffff"}}' }]

describe('importing as Light and Dark', () => {
  test('a file of one mode goes to a new Light, and to a new Dark under the dark class', () => {
    const graph = new SceneGraph()
    const [choice] = themeImportOptions(graph, readDesignTokens(FILE)).collections
    expect(choice.modes).toEqual([{ kind: 'new', name: 'Light' }])
    expect(choice.copies).toEqual([
      { from: 0, target: { kind: 'new', name: 'Dark' }, condition: '.dark' }
    ])
  })

  test("a collection's own Dark keeps where it applies, and takes the dark class if it has none", () => {
    const graph = new SceneGraph()
    const bundle = readDesignTokens(FILE)
    const collection = graph.createCollection(bundle.collections[0].name)
    const light = collection.modes[0].modeId
    graph.renameMode(collection.id, light, 'Light')
    const dark = graph.createMode(collection.id, 'Dark') ?? ''
    const copy = () => themeImportOptions(graph, bundle).collections[0].copies
    // The file's mode is named Default, which matches no mode, so it is written to both.
    expect(copy()).toEqual([
      { from: 0, target: { kind: 'existing', modeId: dark }, condition: '.dark' }
    ])
    const darkMode = collection.modes.find((mode) => mode.modeId === dark)
    if (darkMode) darkMode.condition = '@media (prefers-color-scheme: dark)'
    expect(copy()).toEqual([
      { from: 0, target: { kind: 'existing', modeId: dark }, condition: undefined }
    ])
  })
})
