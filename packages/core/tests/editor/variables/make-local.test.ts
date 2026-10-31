import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { buildFigmaClipboardHTML, parseFigmaClipboard } from '@open-pencil/core/clipboard'
import { initCodec } from '@open-pencil/core/kiwi'

import { createEditor } from '#core/editor'

function libraryEditor() {
  const editor = createEditor()
  editor.graph.addCollection({
    id: 'tokens',
    name: 'Tokens',
    modes: [{ modeId: 'default', name: 'Default' }],
    defaultModeId: 'default',
    variableIds: [],
    key: 'library-key',
    version: '3'
  })
  editor.graph.addVariable({
    id: 'gap',
    name: 'Gap',
    type: 'FLOAT',
    collectionId: 'tokens',
    valuesByMode: { default: 8 },
    description: '',
    hiddenFromPublishing: false,
    key: 'gap-key',
    version: '3'
  })
  editor.graph.addVariable({
    id: 'gap-large',
    name: 'Gap large',
    type: 'FLOAT',
    collectionId: 'tokens',
    valuesByMode: { default: { aliasId: 'gap' } },
    description: '',
    hiddenFromPublishing: false
  })
  return editor
}

describe('make a library collection local', () => {
  test('drops the library keys and keeps the aliases', () => {
    const editor = libraryEditor()
    editor.makeCollectionLocal('tokens')
    const collection = editor.graph.variableCollections.get('tokens')
    expect(collection?.key).toBeUndefined()
    expect(collection?.version).toBeUndefined()
    expect(editor.graph.variables.get('gap')?.key).toBeUndefined()
    expect(editor.graph.variables.get('gap')?.version).toBeUndefined()
    expect(editor.graph.variables.get('gap-large')?.valuesByMode.default).toEqual({ aliasId: 'gap' })
    expect(editor.graph.resolveNumberVariable('gap-large')).toBe(8)
  })

  test('undo restores the keys and redo drops them again', () => {
    const editor = libraryEditor()
    editor.makeCollectionLocal('tokens')
    editor.undo.undo()
    expect(editor.graph.variableCollections.get('tokens')?.key).toBe('library-key')
    expect(editor.graph.variables.get('gap')?.key).toBe('gap-key')
    editor.undo.redo()
    expect(editor.graph.variableCollections.get('tokens')?.key).toBeUndefined()
    expect(editor.graph.variableCollections.get('tokens')?.version).toBeUndefined()
    expect(editor.graph.variables.get('gap')?.key).toBeUndefined()
    expect(editor.graph.variables.get('gap')?.version).toBeUndefined()
  })

  test('a second call changes nothing, so one undo restores the keys', () => {
    const editor = libraryEditor()
    editor.makeCollectionLocal('tokens')
    editor.makeCollectionLocal('tokens')
    editor.undo.undo()
    expect(editor.graph.variableCollections.get('tokens')?.key).toBe('library-key')
  })

  test('an undo step does not touch a document that replaced the one it was made in', () => {
    const editor = libraryEditor()
    editor.makeCollectionLocal('tokens')
    const other = libraryEditor()
    other.makeCollectionLocal('tokens')
    const replacement = other.graph
    editor.replaceGraph(replacement)
    editor.undo.undo()
    expect(replacement.variableCollections.get('tokens')?.key).toBeUndefined()
    expect(replacement.variables.get('gap')?.key).toBeUndefined()
  })

  test('a Figma copy after making it local names the variables by derived keys, not the library ones', async () => {
    await initCodec()
    const editor = libraryEditor()
    editor.makeCollectionLocal('tokens')
    const rect = editor.graph.createNode('RECTANGLE', editor.graph.getPages()[0].id, {
      name: 'Swatch',
      boundVariables: { itemSpacing: 'gap' }
    })
    const html = expectDefined(await buildFigmaClipboardHTML([rect], editor.graph))
    const { nodes } = expectDefined(await parseFigmaClipboard(html))
    const variable = expectDefined(nodes.find((record) => record.type === 'VARIABLE'))
    const set = expectDefined(nodes.find((record) => record.type === 'VARIABLE_SET'))
    expect(variable.key).toMatch(/^[0-9a-f]{40}$/)
    expect(set.key).toMatch(/^[0-9a-f]{40}$/)
    expect(variable.key).not.toBe('gap-key')
    expect(set.key).not.toBe('library-key')
    // The keys belong to the copy only: the document stays local.
    expect(editor.graph.variables.get('gap')?.key).toBeUndefined()
  })
})
