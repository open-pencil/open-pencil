import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createEditor, executeAtomicTool, ReadOnlyDocumentError } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'

import { READ_ONLY_ACTIONS } from '#core/editor/read-only/actions'

function setup() {
  const editor = createEditor()
  const pageId = editor.graph.getPages()[0].id
  const rect = editor.graph.createNode('RECTANGLE', pageId, {
    name: 'Rect',
    x: 10,
    y: 20,
    width: 50,
    height: 50
  })
  editor.select([rect.id])
  return { editor, pageId, rect }
}

describe('read-only documents', () => {
  test('every action kept while read-only is an editor action', () => {
    const { editor } = setup()
    const actions = new Set(
      Object.entries(Object.getOwnPropertyDescriptors(editor))
        .filter(([, descriptor]) => typeof descriptor.value === 'function')
        .map(([name]) => name)
    )
    expect([...READ_ONLY_ACTIONS].filter((name) => !actions.has(name))).toEqual([])
  })

  test('refuses edits and leaves the document as it was', () => {
    const { editor, rect } = setup()
    editor.setReadOnly(true)

    expect(() => editor.setOpacity(0.5)).toThrow(ReadOnlyDocumentError)
    expect(() => editor.nudgeSelected(10, 0)).toThrow(ReadOnlyDocumentError)
    expect(() => editor.deleteSelected()).toThrow(ReadOnlyDocumentError)
    expect(() => editor.updateNodeWithUndo(rect.id, { name: 'Renamed' })).toThrow(
      ReadOnlyDocumentError
    )
    expect(() => editor.addPage('Second')).toThrow(ReadOnlyDocumentError)
    expect(() => editor.undoAction()).toThrow(ReadOnlyDocumentError)

    const node = getNodeOrThrow(editor.graph, rect.id)
    expect(node).toMatchObject({ name: 'Rect', x: 10, opacity: 1 })
    expect(editor.graph.getPages()).toHaveLength(1)
  })

  test('keeps selecting, moving around, and copying', () => {
    const { editor, rect } = setup()
    editor.setReadOnly(true)

    editor.clearSelection()
    editor.selectAll()
    expect([...editor.state.selectedIds]).toEqual([rect.id])
    editor.zoomToSelection()
    editor.pan(10, 10)
    expect(editor.copySelectionAsText([rect.id])).toBe('Rect')
    expect(editor.getNode(rect.id)?.name).toBe('Rect')
  })

  test('clears a rotation preview, which only shows on the canvas', () => {
    const { editor, rect } = setup()
    editor.setRotationPreview({ nodeId: rect.id, angle: 30 })
    editor.setReadOnly(true)

    editor.setRotationPreview(null)
    expect(editor.state.rotationPreview).toBeNull()
  })

  test('keeps only the tools that do not edit', () => {
    const { editor } = setup()
    editor.setTool('RECTANGLE')
    const changes: boolean[] = []
    editor.onEditorEvent('document:read-only-changed', (readOnly) => changes.push(readOnly))

    editor.setReadOnly(true)
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('PEN')
    expect(editor.state.activeTool).toBe('SELECT')
    editor.setTool('HAND')
    expect(editor.state.activeTool).toBe('HAND')

    editor.setReadOnly(false)
    editor.setTool('PEN')
    expect(editor.state.activeTool).toBe('PEN')
    expect(changes).toEqual([true, false])
  })

  test('edits again once editable', () => {
    const { editor, rect } = setup()
    editor.setReadOnly(true)
    editor.setReadOnly(false)

    editor.setOpacity(0.5)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.5)
  })

  test('agents cannot edit through atomic tools', () => {
    const { editor, rect } = setup()
    const setOpacity = ALL_TOOLS.find((tool) => tool.name === 'set_opacity')
    if (!setOpacity) throw new Error('set_opacity is missing')
    editor.setReadOnly(true)

    expect(() =>
      executeAtomicTool(editor, new FigmaAPI(editor.graph), setOpacity, { id: rect.id, value: 0.5 })
    ).toThrow(ReadOnlyDocumentError)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
  })

  test('keeps the undo history but refuses to step through it', () => {
    const { editor, rect } = setup()
    editor.setOpacity(0.5)
    editor.setReadOnly(true)

    expect(editor.undo.canUndo).toBe(true)
    expect(() => editor.undo.undo()).toThrow(ReadOnlyDocumentError)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.5)
  })
})
