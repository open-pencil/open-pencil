import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '@open-pencil/test-support/assert'
import {
  createEditor,
  executeAtomicTool,
  FixedLayersError,
  resolveEditorProfile
} from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'

import { PATH_EDIT_ACTIONS } from '#core/editor/read-only/actions'

/** An editor with one open path, a line from (0, 0) to (100, 0), whose layers the host keeps. */
function setup() {
  const editor = createEditor()
  const path = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
    name: 'Path',
    width: 100,
    height: 1,
    vectorNetwork: {
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    }
  })
  editor.select([path.id])
  editor.setHostRestrictions({ layerEdits: 'none' })
  return { editor, path }
}

describe('layers the host keeps as they are', () => {
  test('every path edit action is an editor action', () => {
    const { editor } = setup()
    const actions = new Set(
      Object.entries(Object.getOwnPropertyDescriptors(editor))
        .filter(([, descriptor]) => typeof descriptor.value === 'function')
        .map(([name]) => name)
    )
    expect([...PATH_EDIT_ACTIONS].filter((name) => !actions.has(name))).toEqual([])
  })

  test('refuses changes to layers and leaves them as they were', () => {
    const { editor, path } = setup()

    expect(() => editor.setOpacity(0.5)).toThrow(FixedLayersError)
    expect(() => editor.nudgeSelected(10, 0)).toThrow(FixedLayersError)
    expect(() => editor.deleteSelected()).toThrow(FixedLayersError)
    expect(() => editor.duplicateSelected()).toThrow(FixedLayersError)
    expect(() => editor.addPage('Second')).toThrow(FixedLayersError)

    expect(getNodeOrThrow(editor.graph, path.id)).toMatchObject({ x: 0, opacity: 1 })
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(1)
  })

  test('still reshapes the path in vector edit mode, and undoes it', () => {
    const { editor, path } = setup()
    editor.enterNodeEditMode(path.id)
    editor.nodeEditSetHandle(0, 'tangentStart', { x: 30, y: 40 })
    editor.exitNodeEditMode(true)
    const tangent = () => getNodeOrThrow(editor.graph, path.id).vectorNetwork?.segments[0]
    expect(tangent()?.tangentStart).toEqual({ x: 30, y: 40 })

    editor.undoAction()
    expect(tangent()?.tangentStart).toEqual({ x: 0, y: 0 })
  })

  test('agents cannot edit through atomic tools', () => {
    const { editor, path } = setup()
    const setOpacity = ALL_TOOLS.find((tool) => tool.name === 'set_opacity')
    if (!setOpacity) throw new Error('set_opacity is missing')
    expect(() =>
      executeAtomicTool(editor, new FigmaAPI(editor.graph), setOpacity, { id: path.id, value: 0.5 })
    ).toThrow(FixedLayersError)
  })

  test('a read-only document keeps its layers too, and edits them again once the host allows', () => {
    const editor = createEditor()
    editor.setReadOnly(true)
    expect(resolveEditorProfile(editor.state).layerEdits).toBe('none')
    editor.setReadOnly(false)

    const { editor: kept, path } = setup()
    kept.setHostRestrictions({ layerEdits: 'all' })
    kept.setOpacity(0.5)
    expect(getNodeOrThrow(kept.graph, path.id).opacity).toBe(0.5)
  })
})
